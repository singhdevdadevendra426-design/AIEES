function StatsCard({ title, value, icon }) {
  return (
    <div className="stats-card">
      <div className="stats-icon">{icon}</div>

      <div className="stats-info">
        <p>{title}</p>
        <h2>{value}</h2>
      </div>
    </div>
  );
}

export default StatsCard;