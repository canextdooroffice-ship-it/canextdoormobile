import React from 'react';
import { Calendar, TrendingUp, Award } from 'lucide-react';

interface AnalyticsProps {
  totalHours: number;
}

export const Analytics: React.FC<AnalyticsProps> = ({ totalHours }) => {
  // Let's create dummy weekly study hour tracking data
  const weekData = [
    { day: 'Mon', hours: 4.5 },
    { day: 'Tue', hours: 6.2 },
    { day: 'Wed', hours: 5.0 },
    { day: 'Thu', hours: 3.5 }, // Today (which matches todayLogged in dashboard)
    { day: 'Fri', hours: 7.0 },
    { day: 'Sat', hours: 8.5 },
    { day: 'Sun', hours: 4.0 },
  ];

  const maxHours = 10;
  const chartHeight = 120;

  return (
    <div className="analytics-container fade-in">
      {/* Overview Cards */}
      <div className="analytics-card">
        <h3 className="card-title">Study Metrics</h3>
        <p className="card-subtitle">Weekly Performance Summary</p>
        
        <div className="analytics-grid">
          <div className="analytics-stat">
            <span className="stat-value">{totalHours}h</span>
            <span className="stat-label">Total Logged</span>
          </div>
          <div className="analytics-stat">
            <span className="stat-value">5.5h</span>
            <span className="stat-label">Daily Avg</span>
          </div>
        </div>
      </div>


      {/* SVG Bar Chart */}
      <div className="chart-card">
        <h3 className="card-title">Study Distribution</h3>
        <p className="card-subtitle">Hours logged per day</p>

        <div className="chart-wrapper">
          <svg className="analytics-svg" viewBox="0 0 350 160">
            {/* Grid lines */}
            <line x1="30" y1="20" x2="330" y2="20" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3" />
            <line x1="30" y1="70" x2="330" y2="70" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3" />
            <line x1="30" y1="120" x2="330" y2="120" stroke="rgba(255, 255, 255, 0.1)" />

            {/* Y axis labels */}
            <text x="5" y="24" className="chart-axis-text">10h</text>
            <text x="5" y="74" className="chart-axis-text">5h</text>
            <text x="5" y="124" className="chart-axis-text">0h</text>

            {/* Bars */}
            {weekData.map((data, idx) => {
              const barWidth = 24;
              const gap = 16;
              const xPos = 40 + idx * (barWidth + gap);
              const barHeight = (data.hours / maxHours) * chartHeight;
              const yPos = 120 - barHeight;

              return (
                <g key={idx} className="chart-bar-group">
                  <rect
                    x={xPos}
                    y={yPos}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    className="chart-bar"
                  />
                  <text
                    x={xPos + barWidth / 2}
                    y={yPos - 6}
                    textAnchor="middle"
                    className="chart-bar-value"
                  >
                    {data.hours}h
                  </text>
                  <text
                    x={xPos + barWidth / 2}
                    y="140"
                    textAnchor="middle"
                    className="chart-axis-label"
                  >
                    {data.day}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Analytics Feed */}
      <div className="insights-card">
        <h3 className="card-title">Study Insights</h3>
        
        <div className="insight-item">
          <div className="insight-icon red">
            <TrendingUp size={16} />
          </div>
          <div className="insight-details">
            <span className="insight-text">Your study hours peaked on <strong>Saturday (8.5h)</strong>. Excellent focus!</span>
          </div>
        </div>

        <div className="insight-item">
          <div className="insight-icon green">
            <Calendar size={16} />
          </div>
          <div className="insight-details">
            <span className="insight-text">You met your daily target on <strong>3 out of 7 days</strong> this week. Keep it up!</span>
          </div>
        </div>

        <div className="insight-item">
          <div className="insight-icon gold">
            <Award size={16} />
          </div>
          <div className="insight-details">
            <span className="insight-text">You are on track to finish the <strong>Advanced Accounting syllabus</strong> by next month.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
