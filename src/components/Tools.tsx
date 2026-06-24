import React from 'react';
import { ArrowLeft, Link as LinkIcon, Sparkles, Clock, Users, Calendar } from 'lucide-react';

interface ToolsProps {
  onBack: () => void;
  onOpenTool: (toolId: string) => void;
}

export const Tools: React.FC<ToolsProps> = ({ onBack, onOpenTool }) => {
  return (
    <div className="tools-container fade-in">
      {/* Header */}
      <div className="tools-header-bar">
        <button 
          type="button" 
          className="tools-back-btn" 
          onClick={onBack}
          aria-label="Back to home"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h2 className="tools-header-title">Tools</h2>
      </div>

      {/* Tools Menu Grid */}
      <div className="tools-menu-grid">
        <div 
          className="tool-menu-card clickable"
          onClick={() => onOpenTool('links-manager')}
        >
          <div className="tool-card-icon-wrapper orange">
            <LinkIcon size={22} />
          </div>
          <div className="tool-card-info">
            <h3 className="tool-card-title">Links Manager</h3>
            <p className="tool-card-desc">
              Save study web links, YouTube lectures, and drive folders to directly open them from one place.
            </p>
          </div>
        </div>

        <div 
          className="tool-menu-card clickable"
          onClick={() => onOpenTool('time-manager')}
        >
          <div className="tool-card-icon-wrapper orange">
            <Clock size={20} />
          </div>
          <div className="tool-card-info">
            <h3 className="tool-card-title">Time Manager</h3>
            <p className="tool-card-desc">
              Track and analyze study hours spent on classes and revisions (R1, R2, R3) for each chapter.
            </p>
          </div>
        </div>

        <div 
          className="tool-menu-card clickable"
          onClick={() => onOpenTool('study-buddy')}
        >
          <div className="tool-card-icon-wrapper green">
            <Users size={20} />
          </div>
          <div className="tool-card-info">
            <h3 className="tool-card-title">Study Buddy & Groups</h3>
            <p className="tool-card-desc">
              Connect with friends using unique codes, coordinate study targets, and focus in Live Rooms.
            </p>
          </div>
        </div>

        <div 
          className="tool-menu-card clickable"
          onClick={() => onOpenTool('timeline')}
        >
          <div className="tool-card-icon-wrapper indigo animate-pulse-subtle">
            <Calendar size={20} />
          </div>
          <div className="tool-card-info">
            <h3 className="tool-card-title">Timeline</h3>
            <p className="tool-card-desc">
              Plan out your entire study timeline, set revision milestones, and track days remaining till exams.
            </p>
          </div>
        </div>
      </div>

      {/* Decorative coming soon banner */}
      <div className="tools-coming-soon-banner">
        <Sparkles size={16} className="sparkle-icon" />
        <span>More utilities are cooking. Got requests? Let us know!</span>
      </div>
    </div>
  );
};
