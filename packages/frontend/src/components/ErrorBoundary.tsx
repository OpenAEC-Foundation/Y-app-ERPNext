import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { withTranslation, type WithTranslation } from "react-i18next";

/**
 * Generic render-error safety net (issue #103: an uncaught render/promise
 * error anywhere in the wrapped subtree used to unmount the whole app,
 * leaving a blank white page with no way back).
 *
 * Usage: wrap any subtree that can crash from data it doesn't fully
 * control (e.g. a form fed by ERPNext permission-scoped lookups). Pass a
 * `resetKey` that changes whenever the wrapped content is meant to be
 * fresh (e.g. a dialog re-opening) — the boundary auto-recovers when that
 * key changes, mirroring how React `key`-based remounts work, so the
 * error state never "sticks" after the user has moved on.
 */
interface Props extends WithTranslation {
  children: ReactNode;
  /** Changing this value clears any caught error and re-renders children. */
  resetKey?: string | number;
  /** Called once, right before the "close" action clears the error. Use
   * this to also reset the parent's own state (e.g. close a dialog) so
   * the crashed UI doesn't just reappear. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

class ErrorBoundaryImpl extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught render error:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleClose = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { t } = this.props;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">{t("error_boundary.title")}</h3>
          <p className="text-sm text-slate-500 mb-5">{t("error_boundary.message")}</p>
          <button
            onClick={this.handleClose}
            className="px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium"
          >
            {t("error_boundary.close")}
          </button>
        </div>
      </div>
    );
  }
}

const ErrorBoundary = withTranslation()(ErrorBoundaryImpl);
export default ErrorBoundary;
