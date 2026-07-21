import React from 'react';
import PropTypes from 'prop-types';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for development troubleshooting
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="icon">!</div>
          <h2 className="title">Something went wrong</h2>
          <p className="message">
            An unexpected error occurred in this section of the application.
          </p>
          <div className="actions">
            <button className="primaryBtn" onClick={this.handleReset} type="button">
              Try Again
            </button>
            <button
              className="secondaryBtn"
              onClick={() => { window.location.href = '/'; }}
              type="button"
            >
              Go to Homepage
            </button>
          </div>
          {this.state.error && (
            <details className="details">
              <summary className="detailsSummary">Technical Details</summary>
              <pre className="detailsContent">
                {this.state.error.stack || this.state.error.message || String(this.state.error)}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  onReset: PropTypes.func
};

export default ErrorBoundary;
