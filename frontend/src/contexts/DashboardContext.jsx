import React, { createContext, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { useOrg } from '../hooks/useOrg';
import { rtdbService } from '../services/rtdbService';
import { dashboardService } from '../services/dashboardService';

export const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { orgId: routeOrgId, ideaId } = useParams();
  const { org, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef(0);

  const orgId = routeOrgId || org?.orgId;

  useEffect(() => {
    const currentSession = ++sessionRef.current;

    // Reset workspace-scoped dashboard stats and recent activity immediately on orgId change
    setStats(null);
    setRecentActivity([]);

    if (orgLoading || !orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const loadData = async () => {
      try {
        const aggregatedStats = await dashboardService.getDashboardStats(orgId, ideaId);
        const timeline = await dashboardService.getRecentActivity(orgId, ideaId);

        if (sessionRef.current !== currentSession) return;
        setStats(aggregatedStats);
        setRecentActivity(timeline);
      } catch (err) {
        if (sessionRef.current === currentSession) {
          console.error('[DashboardProvider] Subscription evaluation error:', err);
        }
      } finally {
        if (sessionRef.current === currentSession) {
          setLoading(false);
        }
      }
    };

    loadData();

    const unsubscribeTasks = rtdbService.subscribe(`tasks/${orgId}`, async () => {
      try {
        const aggregatedStats = await dashboardService.getDashboardStats(orgId, ideaId);
        const timeline = await dashboardService.getRecentActivity(orgId, ideaId);

        if (sessionRef.current !== currentSession) return;
        setStats(aggregatedStats);
        setRecentActivity(timeline);
      } catch (err) {
        if (sessionRef.current === currentSession) {
          console.error('[DashboardProvider] Subscription evaluation error:', err);
        }
      } finally {
        if (sessionRef.current === currentSession) {
          setLoading(false);
        }
      }
    });

    return () => {
      sessionRef.current++;
      unsubscribeTasks();
    };
  }, [orgId, ideaId, orgLoading]);

  return (
    <DashboardContext.Provider value={{ stats, recentActivity, loading: loading || orgLoading }}>
      {children}
    </DashboardContext.Provider>
  );
}

DashboardProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
