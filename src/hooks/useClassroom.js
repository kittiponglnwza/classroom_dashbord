import { useContext } from 'react';
import { ClassroomContext } from '../contexts/ClassroomContext';

export const useClassroom = () => {
  const context = useContext(ClassroomContext);
  if (!context) {
    throw new Error('useClassroom must be used within a ClassroomProvider');
  }
  return context;
};
