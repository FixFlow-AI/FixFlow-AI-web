import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      `%c[React Error Boundary]%c A component crashed!\n` +
      `Error: ${error?.message || error}\n` +
      `Component Stack:`,
      'color: #ef4444; font-weight: bold;', 'color: inherit;',
      errorInfo?.componentStack
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50 text-red-700">
          <p className="text-sm font-medium">Something went wrong in this section.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-sm underline"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
