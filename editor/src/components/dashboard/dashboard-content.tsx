'use client';

import { useState, useEffect } from 'react';
import { ProjectList } from './project-list.js';
import { CreateProjectModal } from './create-project-modal.js';
import type { DBProject } from '@/types/project';

export function DashboardContent() {
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const { projects } = await response.json();
        setProjects(projects);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectCreated = (project: DBProject) => {
    setProjects((prev) => [project, ...prev]);
    // Open the new project in a new tab
    window.open(`/editor/${project.id}`, '_blank');
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleOpenProject = (id: string) => {
    window.open(`/editor/${id}`, '_blank');
  };

  return (
    <>
      <ProjectList
        projects={projects}
        isLoading={isLoading}
        onCreateProject={() => setShowCreateModal(true)}
        onDeleteProject={handleDeleteProject}
        onOpenProject={handleOpenProject}
      />

      <CreateProjectModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={handleProjectCreated}
      />
    </>
  );
}
