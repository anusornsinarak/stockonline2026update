
import React from 'react';
import { AdminDashboard as DashboardComponent } from './components/AdminDashboard';
import { User, DocumentSettings } from './types';

interface AdminDashboardProps {
  user: User;
  isSurveyManuallyOpen: boolean;
  isSurveyAutoOpen: boolean;
  onToggleSurvey: (isOpen: boolean) => void;
  isRequisitionOpen: boolean;
  onToggleRequisition: (isOpen: boolean) => void;
  onDataChange: () => void;
  onSettingsChange: () => void;
  initialTab?: any;
  documentSettings: DocumentSettings | null;
  currentFiscalYearBE: number;
  nextFiscalYearBE: number;
  stopAlert: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  return <DashboardComponent {...props} />;
};

export default AdminDashboard;
