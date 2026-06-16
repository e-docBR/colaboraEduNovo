import { Alert, Button } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { useAppSelector } from "../../app/hooks";
import { useListAcademicYearsQuery, useUpdateAcademicYearStatusMutation } from "../../lib/api";

export const ClosedYearBanner = () => {
  const user = useAppSelector((s) => s.auth.user);
  const currentYearId = useAppSelector((s) => s.app.academicYearId);
  const { data: years } = useListAcademicYearsQuery();
  const [updateStatus, { isLoading }] = useUpdateAcademicYearStatusMutation();

  const selectedYear = years?.find((y) => y.id === currentYearId);
  if (!selectedYear || selectedYear.status !== "closed") return null;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const handleReopen = async () => {
    if (!selectedYear) return;
    await updateStatus({ yearId: selectedYear.id, status: "open" });
  };

  return (
    <Alert
      severity="warning"
      icon={<LockIcon fontSize="small" />}
      sx={{ borderRadius: 0, mb: 2 }}
      action={
        isAdmin ? (
          <Button color="warning" size="small" onClick={handleReopen} disabled={isLoading}>
            {isLoading ? "Reabrindo..." : "Reabrir"}
          </Button>
        ) : undefined
      }
    >
      Ano letivo <strong>{selectedYear.label}</strong> encerrado — dados são somente leitura.
    </Alert>
  );
};
