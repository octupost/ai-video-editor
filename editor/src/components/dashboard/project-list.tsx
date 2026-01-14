'use client';

import { Plus, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectCard } from './project-card';
import type { DBProject } from '@/types/project';

interface ProjectListProps {
  projects: DBProject[];
  isLoading: boolean;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onOpenProject: (id: string) => void;
}

export function ProjectList({
  projects,
  isLoading,
  onCreateProject,
  onDeleteProject,
  onOpenProject,
}: ProjectListProps) {
  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[72px] bg-muted/50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
          <FolderPlus className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            No projects yet
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Create your first project to start editing videos with AI assistance.
          </p>
        </div>
        <Button size="lg" onClick={onCreateProject} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Project
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Your Projects</h2>
        <Button size="sm" onClick={onCreateProject} className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      <div className="grid gap-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={onDeleteProject}
            onClick={() => onOpenProject(project.id)}
          />
        ))}
      </div>
    </div>
  );
}
