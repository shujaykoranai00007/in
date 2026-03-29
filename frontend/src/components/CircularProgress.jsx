import React from "react";

const CircularProgress = ({ size = 120, strokeWidth = 8, percent = 0, colorPrimary = "#3b82f6", colorSecondary = "#10b981", label = "" }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="circular-progress-ring">
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorPrimary} />
            <stop offset="100%" stopColor={colorSecondary} />
          </linearGradient>
        </defs>
        <circle
          className="circular-progress-bg"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="circular-progress-value"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset: offset }}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold font-display leading-none">{Math.round(percent)}%</span>
        {label && <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</span>}
      </div>
    </div>
  );
};

export default CircularProgress;
