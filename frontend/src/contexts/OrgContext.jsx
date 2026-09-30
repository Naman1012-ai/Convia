import React, { createContext, useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { orgService } from '../services/orgService';
import { useUserProfileSync } from './UserProfileSyncContext';
import { resolveMemberDisplayName } from '../utils/memberIdentity';

export const OrgContext = createContext({
  org: null,
  members: [],
  isLeader: false,
  isFrozen: false,
  loading: true,
  error: null,
});

export function OrgProvider({ orgId, children }) {
  const { user } = useAuth();
  const { profiles, subscribeUsers } = useUserProfileSync();
  const [org, setOrg] = useState(null);
  const [rawMembers, setRawMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const sessionRef = useRef(0);

  useEffect(() => {
    const currentSession = ++sessionRef.current;

    // Reset workspace-scoped state immediately upon orgId change
    setOrg(null);
    setRawMembers([]);

    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time Org metadata
    const unsubscribeOrg = orgService.subscribeToOrganization(orgId, (orgData) => {
      if (sessionRef.current !== currentSession) return;
      if (!orgData) {
        setError('Organization not found.');
        setOrg(null);
      } else if (orgData.isDeleted && user && orgData.ownerId !== user.uid) {
        setError('This workspace has been deleted by the owner.');
        setOrg(null);
      } else {
        setOrg(orgData);
      }
      setLoading(false);
    });

    // Subscribe to real-time Member Roster
    const unsubscribeMembers = orgService.subscribeToOrgMembers(orgId, (membersList) => {
      if (sessionRef.current !== currentSession) return;
      setRawMembers(membersList || []);
    });

    return () => {
      sessionRef.current++;
      unsubscribeOrg();
      unsubscribeMembers();
    };
  }, [orgId, user]);

  // Subscribe to real-time profile updates for all workspace members
  useEffect(() => {
    if (!Array.isArray(rawMembers) || rawMembers.length === 0) return;
    const memberUids = rawMembers.map((m) => m.uid || m.id).filter(Boolean);
    const unsub = subscribeUsers(memberUids);
    return unsub;
  }, [rawMembers, subscribeUsers]);

  // Dynamically resolve and augment members with real-time profile data
  const members = useMemo(() => {
    if (!Array.isArray(rawMembers)) return [];
    return rawMembers.map((member) => {
      const uid = member.uid || member.id;
      const liveProfile = profiles[uid];
      if (!liveProfile) return member;

      const liveName = resolveMemberDisplayName(liveProfile);
      const liveAvatar = liveProfile.photoURL || liveProfile.avatar;

      return {
        ...member,
        ...liveProfile,
        name: liveName || member.name || member.displayName || 'Member',
        displayName: liveName || member.displayName || member.name || 'Member',
        avatar: liveAvatar || member.avatar || member.photoURL || '',
        photoURL: liveAvatar || member.photoURL || member.avatar || '',
        role: member.role || member.workspaceRole || 'member',
        workspaceRole: member.role || member.workspaceRole || 'member',
      };
    });
  }, [rawMembers, profiles]);

  const currentMember = members.find((m) => m.uid === user?.uid);
  const isLeader = Boolean(user && org && (org.ownerId === user.uid || org.createdBy === user.uid));
  const isOrgAdmin = Boolean(isLeader || currentMember?.role === 'admin');
  const isFrozen = Boolean(org && org.status === 'project');

  // Authoritatively derive org.memberCount from live canonical members roster
  const resolvedOrg = useMemo(() => {
    if (!org) return null;
    return {
      ...org,
      memberCount: members.length,
    };
  }, [org, members.length]);

  return (
    <OrgContext.Provider value={{ org: resolvedOrg, members, isLeader, isOrgAdmin, isFrozen, loading, error }}>
      {children}
    </OrgContext.Provider>
  );
}

OrgProvider.propTypes = {
  orgId: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
