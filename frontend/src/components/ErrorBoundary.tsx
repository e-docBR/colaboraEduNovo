import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Typography, Button } from "@mui/material";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    // Integração com ferramentas de monitoramento (ex: Sentry).
    // Para ativar: window.__reportError = Sentry.captureException
    const reporter = (window as unknown as Record<string, unknown>).__reportError;
    if (typeof reporter === "function") {
      try {
        (reporter as (e: Error, ctx?: unknown) => void)(error, { componentStack: info.componentStack });
      } catch {
        // nunca silencia o erro original por falha no reporter
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight={200}
          gap={2}
          p={4}
        >
          <Typography variant="h6" color="error">
            Algo deu errado
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {this.state.error?.message ?? "Erro inesperado no componente."}
          </Typography>
          <Button variant="outlined" size="small" onClick={this.handleReset}>
            Tentar novamente
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
