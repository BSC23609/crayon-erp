import { Link } from 'react-router-dom'
export default function NotFound() {
  return (
    <div className="px-6 py-20 text-center">
      <h1 className="text-xl font-semibold">This page does not exist</h1>
      <p className="mt-2 text-sm text-ink-soft">Check the address, or press Ctrl K to search for the page you need.</p>
      <Link to="/" className="btn-outline mt-6">Back to Today</Link>
    </div>
  )
}
