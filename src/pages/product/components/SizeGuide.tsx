import { SIZE_GUIDE_COLUMNS, SIZE_GUIDE_ROWS, SIZE_GUIDE_TOLERANCE } from '../../../data/sizeGuide'

export function SizeGuide() {
  return (
    <details className="duskeo-size-guide">
      <summary>
        SIZE GUIDE <span>MEASUREMENTS IN CM</span>
      </summary>
      <div className="duskeo-size-table-wrap">
        <table className="duskeo-size-table">
          <thead>
            <tr>
              {SIZE_GUIDE_COLUMNS.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZE_GUIDE_ROWS.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="duskeo-size-tolerance">{SIZE_GUIDE_TOLERANCE}</p>
    </details>
  )
}
