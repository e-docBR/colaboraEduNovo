import { useState, useMemo } from "react";
import { 
  Box, 
  Typography, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { useListTurmasQuery, useGetTurmaAlunosQuery } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import { styled } from "@mui/material/styles";

// Styled components for print formatting
const PrintContainer = styled(Box)(() => ({
  '@media print': {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: '20px',
    backgroundColor: 'white',
    color: 'black',
    // Hide everything else on the page
    '& .no-print': {
      display: 'none !important',
    },
    // Reset background for printing
    '@page': {
      size: 'landscape',
      margin: '10mm',
    }
  }
}));

const StyledTableCell = styled(TableCell)(() => ({
  border: '1px solid #000',
  padding: '4px 8px',
  fontSize: '11px',
  color: '#000',
  '@media print': {
    border: '1px solid #000 !important',
    color: '#000 !important',
  }
}));

const VerticalText = styled('div')({
  writingMode: 'vertical-rl',
  transform: 'rotate(180deg)',
  textAlign: 'center',
  padding: '8px 4px',
  fontWeight: 'bold',
  fontSize: '11px',
  height: '140px',
  whiteSpace: 'nowrap'
});

const formatBirthDate = (dateStr?: string | null) => {
  if (!dateStr) return "--/--/----";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

export const AtaResultadoPage = () => {
  const [selectedTurmaSlug, setSelectedTurmaSlug] = useState<string>("");
  
  const { data: turmasData, isLoading: loadingTurmas } = useListTurmasQuery();
  const { data: turmaAlunos, isLoading: loadingAlunos, isFetching } = useGetTurmaAlunosQuery(selectedTurmaSlug, {
    skip: !selectedTurmaSlug,
  });

  const user = useAppSelector((state) => state.auth.user);
  const tenantName = user?.tenant_name || "Prefeitura Municipal";

  const handlePrint = () => {
    window.print();
  };

  // Extract unique disciplines to form the columns
  const disciplines = useMemo(() => {
    if (!turmaAlunos?.alunos) return [];
    const discSet = new Set<string>();
    turmaAlunos.alunos.forEach(aluno => {
      aluno.notas?.forEach(n => {
        if (n.disciplina) discSet.add(n.disciplina);
      });
    });
    return Array.from(discSet).sort();
  }, [turmaAlunos]);

  // Calculate final results
  const alunosData = useMemo(() => {
    if (!turmaAlunos?.alunos) return [];
    
    return turmaAlunos.alunos.map(aluno => {
      const discScores: Record<string, number> = {};
      let totalSoma = 0;
      let count = 0;

      disciplines.forEach(d => {
        const nota = aluno.notas?.find(n => n.disciplina === d);
        if (nota) {
          const sum = typeof nota.total === 'number' ? nota.total : 
                     (nota.trimestre1 || 0) + (nota.trimestre2 || 0) + (nota.trimestre3 || 0);
          discScores[d] = sum;
          totalSoma += sum;
          count++;
        } else {
          discScores[d] = 0;
        }
      });

      const mediaGeral = count > 0 ? totalSoma / count : 0;
      // Simple approval criteria: Media >= 50 or total sum per discipline >= 50
      // Depending on the school's specific rule. Assuming 50/100 is passing.
      const resultadoFinal = mediaGeral >= 50 ? "AP" : "RP";

      return {
        ...aluno,
        discScores,
        resultadoFinal
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [turmaAlunos, disciplines]);

  const currentDate = new Date();
  const day = currentDate.getDate();
  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const monthName = monthNames[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  const selectedTurmaObj = turmasData?.items?.find(t => t.slug === selectedTurmaSlug);

  return (
    <Box sx={{ minHeight: "100vh", pb: 5 }}>
      {/* Page Header (No Print) */}
      <Box className="no-print" mb={4} display="flex" flexDirection={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: "-0.03em", color: "#0A2540", mb: 0.5 }}>
            Ata de Resultado Final
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
            Selecione uma turma para gerar e imprimir a Ata de Resultado Final.
          </Typography>
        </Box>
        
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Turma</InputLabel>
            <Select
              value={selectedTurmaSlug}
              label="Turma"
              onChange={(e) => setSelectedTurmaSlug(e.target.value)}
              disabled={loadingTurmas}
            >
              <MenuItem value="">
                <em>Selecione...</em>
              </MenuItem>
              {turmasData?.items?.map((t) => (
                <MenuItem key={t.slug} value={t.slug}>
                  {t.turma} - {t.turno}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button 
            variant="contained" 
            startIcon={<PrintIcon />} 
            onClick={handlePrint}
            disabled={!selectedTurmaSlug || isFetching || !turmaAlunos}
            sx={{ backgroundColor: "#0A2540", "&:hover": { backgroundColor: "#1E3A5F" } }}
          >
            Imprimir PDF
          </Button>
        </Box>
      </Box>

      {/* Loading State */}
      {(loadingAlunos || isFetching) && (
        <Box display="flex" justifyContent="center" my={10} className="no-print">
          <CircularProgress />
        </Box>
      )}

      {/* Print View Container */}
      {!isFetching && turmaAlunos && selectedTurmaObj && (
        <PrintContainer>
          {/* Official Document Header */}
          <Box textAlign="center" mb={4} sx={{ fontFamily: 'Times New Roman, serif' }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#000', fontSize: '14px', lineHeight: 1.2 }}>
              {tenantName}
              <br />
              {/* Fallback CNPJ or omit if dynamic is needed - using a placeholder as asked to fetch dynamically but no field exists */}
              CNPJ: --
              <br />
              Secretaria Municipal de Educação
            </Typography>
            
            <Box my={3} borderBottom="1px solid #000" />
            
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#000', fontSize: '14px' }}>
              ATA DE RESULTADO FINAL / MÉDIA: 50,0
              <br />
              {selectedTurmaObj.turma} - {selectedTurmaObj.turno.toUpperCase()}
            </Typography>
            
            <Typography variant="body2" sx={{ textAlign: 'justify', mt: 2, color: '#000', fontSize: '12px' }}>
              Aos <u>&nbsp;{String(day).padStart(2, '0')}&nbsp;</u> dia do mês de <u>&nbsp;{monthName}&nbsp;</u> do ano de <u>&nbsp;{year}&nbsp;</u> terminou-se o Processo de Apuração das Notas Finais dos respectivos alunos do(a): <b>Fundamental II</b>. Turma: <b>{selectedTurmaObj.turma} - {selectedTurmaObj.turno.toUpperCase()}</b>. Turno: <b>{selectedTurmaObj.turno}</b> desta Unidade Escolar, com os seguintes resultados.
            </Typography>
          </Box>

          {/* Grades Table */}
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0, overflow: 'visible', '& .MuiPaper-root': { backgroundColor: 'transparent' } }}>
            <Table size="small" sx={{ minWidth: 650, borderCollapse: 'collapse' }} aria-label="Ata table">
              <TableHead>
                <TableRow>
                  <StyledTableCell rowSpan={2} sx={{ width: '40%', fontWeight: 'bold' }}>Alunos</StyledTableCell>
                  <StyledTableCell rowSpan={2} align="center" sx={{ width: '80px', fontWeight: 'bold' }}>Data de<br/>Nascimento</StyledTableCell>
                  <StyledTableCell rowSpan={2} align="center" sx={{ width: '40px', fontWeight: 'bold' }}>SEXO</StyledTableCell>
                  <StyledTableCell colSpan={disciplines.length} align="center" sx={{ fontWeight: 'bold' }}>DISCIPLINAS / MÉDIA ANUAL</StyledTableCell>
                  <StyledTableCell rowSpan={2} align="center" sx={{ width: '120px', fontWeight: 'bold' }}>RESULTADO FINAL</StyledTableCell>
                </TableRow>
                <TableRow>
                  {disciplines.map(d => (
                    <StyledTableCell key={d} align="center" sx={{ padding: '0 !important', verticalAlign: 'bottom', backgroundColor: '#f5f5f5', '@media print': { backgroundColor: '#f5f5f5 !important', WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' } }}>
                      <VerticalText>{d.toUpperCase()}</VerticalText>
                    </StyledTableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {alunosData.map((aluno) => (
                  <TableRow key={aluno.id} sx={{ '&:nth-of-type(even)': { backgroundColor: '#fdfdfd' } }}>
                    <StyledTableCell sx={{ textTransform: 'uppercase' }}>{aluno.nome}</StyledTableCell>
                    <StyledTableCell align="center">{formatBirthDate(aluno.data_nascimento)}</StyledTableCell>
                    <StyledTableCell align="center">{aluno.sexo || '-'}</StyledTableCell>
                    
                    {disciplines.map(d => (
                      <StyledTableCell key={d} align="center">
                        {aluno.discScores[d].toFixed(1).replace('.', ',')}
                      </StyledTableCell>
                    ))}
                    
                    <StyledTableCell align="center" sx={{ fontWeight: 'bold', color: aluno.resultadoFinal === "AP" ? '#000' : 'red', '@media print': { color: '#000 !important' } }}>
                      {aluno.resultadoFinal}
                    </StyledTableCell>
                  </TableRow>
                ))}
                {alunosData.length === 0 && (
                  <TableRow>
                    <StyledTableCell colSpan={disciplines.length + 4} align="center">
                      Nenhum aluno encontrado para esta turma.
                    </StyledTableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </PrintContainer>
      )}
    </Box>
  );
};
