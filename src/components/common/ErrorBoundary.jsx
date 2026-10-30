import { Component } from 'react'
import ErrorState from './ErrorState.jsx'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }

  render() {
    if (this.state.failed) return <ErrorState onRetry={() => this.setState({ failed: false })} />
    return this.props.children
  }
}
