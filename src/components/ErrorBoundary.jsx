import React from 'react';
import PropTypes from 'prop-types';
import styles from './ErrorBoundary.module.css';

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
        <div className={styles.container}>
          <div className={styles.icon}>!</div>
          <h2 className={styles.title}>Something went wrong</h2>
          <p className={styles.message}>
            An unexpected error occurred in this section of the application.
          </p>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={this.handleReset} type="button">
              Try Again
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={() => { window.location.href = '/'; }}
              type="button"
            >
              Go to Homepage
            </button>
          </div>
          {this.state.error && (
            <details className={styles.details}>
              <summary className={styles.detailsSummary}>Technical Details</summary>
              <pre className={styles.detailsContent}>
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
