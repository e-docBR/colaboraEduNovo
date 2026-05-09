import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline } from "@mui/material";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";

import { store } from "./app/store";
import { appRouter } from "./app/routes";
import { AppThemeProvider } from "./theme";

const Root = () => {
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <CssBaseline />
        <RouterProvider router={appRouter} future={{ v7_startTransition: true }} />
      </AppThemeProvider>
    </Provider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

