import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import AssignmentDetail from './pages/AssignmentDetail';
import Settings from './pages/Settings';
import { 
  getAssignments, 
  updateAssignmentStatus, 
  updateAssignmentNotes,
  addAssignment, 
  getCourses, 
  getProfile, 
  saveProfile, 
  resetDatabase 
} from './utils/storage';

export default function App() {
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState({});

  // Initialize data on mount
  useEffect(() => {
    setAssignments(getAssignments());
    setCourses(getCourses());
    setProfile(getProfile());
  }, []);

  // Handler to update task status
  const handleStatusChange = (id, newStatus) => {
    const updated = updateAssignmentStatus(id, newStatus);
    setAssignments(updated);
  };

  // Handler to update assignment notes
  const handleNotesChange = (id, newNotes) => {
    const updated = updateAssignmentNotes(id, newNotes);
    setAssignments(updated);
  };

  // Handler to add custom assignment
  const handleAddAssignment = (newAssign) => {
    const updated = addAssignment(newAssign);
    setAssignments(updated);
  };

  // Handler to save profile configuration
  const handleProfileSave = (updatedProfile) => {
    saveProfile(updatedProfile);
    setProfile(updatedProfile);
  };

  // Handler to clear database to default mock
  const handleReset = () => {
    const resetData = resetDatabase();
    setAssignments(resetData.assignments);
    setCourses(resetData.courses);
    setProfile(resetData.profile);
  };

  return (
    <Router>
      <Layout courses={courses} assignments={assignments}>
        <Routes>
          <Route 
            path="/" 
            element={
              <Home 
                assignments={assignments} 
                onStatusChange={handleStatusChange} 
                courses={courses} 
              />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <Dashboard 
                assignments={assignments} 
                onStatusChange={handleStatusChange} 
                onAddAssignment={handleAddAssignment}
                courses={courses} 
              />
            } 
          />
          <Route 
            path="/courses" 
            element={
              <Courses 
                courses={courses} 
                assignments={assignments} 
                onStatusChange={handleStatusChange} 
              />
            } 
          />
          <Route 
            path="/assignments/:id" 
            element={
              <AssignmentDetail 
                assignments={assignments} 
                onStatusChange={handleStatusChange} 
                onNotesChange={handleNotesChange}
              />
            } 
          />
          <Route 
            path="/settings" 
            element={
              <Settings 
                profile={profile} 
                onProfileSave={handleProfileSave} 
                onResetDatabase={handleReset} 
              />
            } 
          />
        </Routes>
      </Layout>
    </Router>
  );
}
