export default function Queue() {
  return (
    <div>
      <h2>Queue</h2>
      <div className="tabs">
        <button>Pending</button>
        <button>Processing</button>
        <button>Failed</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Media</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>video.mp4</td>
            <td>Pending</td>
            <td>
              <button>Retry</button>
              <button>Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
