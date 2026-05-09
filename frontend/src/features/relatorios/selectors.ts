import { useMemo } from "react";
import { useListNotasQuery, type NotaResumo } from "../../lib/api";
import { type RelatorioSlug } from "./config";

const calculateTrend = (nota: NotaResumo): number => {
    const t1 = nota.trimestre1;
    const t2 = nota.trimestre2;
    const t3 = nota.trimestre3;

    if (typeof t3 === "number" && typeof t2 === "number") return t3 - t2;
    if (typeof t3 === "number" && typeof t1 === "number") return t3 - t1;
    if (typeof t2 === "number" && typeof t1 === "number") return t2 - t1;
    return 0;
};

const calculateRisk = (notas: NotaResumo[]): number => {
    let risk = 0;
    let totalAbsences = 0;
    let droppingGrades = 0;
    let failures = 0;

    notas.forEach(n => {
        const total = n.total ?? 0;
        const trend = calculateTrend(n);

        totalAbsences += n.faltas ?? 0;
        if (trend < -5) droppingGrades++;
        if (total > 0 && total < 60) failures++;
    });

    risk += Math.min(0.5, failures * 0.1);
    risk += Math.min(0.3, (totalAbsences / 20) * 0.1);
    risk += Math.min(0.2, droppingGrades * 0.1);

    return Math.min(0.99, risk);
};

export const useDerivedRelatorio = (slug: RelatorioSlug | undefined, filters: any) => {
    const { data: notasData, isLoading: isLoadingNotas } = useListNotasQuery(undefined);

    const derivedData = useMemo(() => {
        if (!slug || !notasData) return { dados: [], summary: undefined };

        // Comparativo Eficiencia - Special Handling for Averages
        if (slug === "comparativo-eficiencia") {
            let baseItems = notasData.items;
            if (filters?.disciplina) baseItems = baseItems.filter(n => n.disciplina === filters.disciplina);
            if (filters?.turno) baseItems = baseItems.filter(n => n.aluno?.turno === filters.turno);

            let schoolSum = 0;
            let schoolCount = 0;
            baseItems.forEach(n => {
                if (typeof n.total === 'number') {
                    schoolSum += n.total;
                    schoolCount++;
                }
            });
            const schoolAvg = schoolCount > 0 ? schoolSum / schoolCount : 0;

            const turmasMap = new Map<string, { sum: number; count: number }>();
            baseItems.forEach(n => {
                if (!n.aluno?.turma || typeof n.total !== 'number') return;
                const t = n.aluno.turma;
                if (!turmasMap.has(t)) turmasMap.set(t, { sum: 0, count: 0 });
                const rec = turmasMap.get(t)!;
                rec.sum += n.total;
                rec.count++;
            });

            let comparison = Array.from(turmasMap.entries()).map(([turma, data]) => ({
                turma,
                media: Number((data.sum / data.count).toFixed(1)),
                escola: Number(schoolAvg.toFixed(1))
            }))
                .sort((a, b) => a.turma.localeCompare(b.turma));

            if (filters?.turma) comparison = comparison.filter(c => c.turma === filters.turma);

            return { dados: comparison, summary: undefined };
        }

        // Standard Filtering for other reports
        let items = notasData.items;
        if (filters?.turma) items = items.filter(n => n.aluno?.turma === filters.turma);
        if (filters?.turno) items = items.filter(n => n.aluno?.turno === filters.turno);
        if (filters?.disciplina) items = items.filter(n => n.disciplina === filters.disciplina);

        if (slug === "radar-abandono") {
            const studentsMap = new Map<number, { nome: string; turma: string; notas: NotaResumo[] }>();
            items.forEach(note => {
                if (!note.aluno?.id) return;
                if (!studentsMap.has(note.aluno.id)) {
                    studentsMap.set(note.aluno.id, {
                        nome: note.aluno.nome,
                        turma: note.aluno.turma,
                        notas: []
                    });
                }
                studentsMap.get(note.aluno.id)?.notas.push(note);
            });

            const riskList = Array.from(studentsMap.values()).map(student => {
                const risk = calculateRisk(student.notas);
                return {
                    nome: student.nome,
                    turma: student.turma,
                    risco: Number(risk.toFixed(2))
                };
            })
                .filter(s => s.risco > 0.3)
                .sort((a, b) => b.risco - a.risco)
                .slice(0, 50);

            return { dados: riskList, summary: undefined };
        }

        if (slug === "top-movers") {
            const studentsMap = new Map<number, { nome: string; turma: string; totalTrend: number; count: number }>();
            items.forEach(note => {
                if (!note.aluno?.id) return;
                const trend = calculateTrend(note);
                if (trend === 0) return;

                if (!studentsMap.has(note.aluno.id)) {
                    studentsMap.set(note.aluno.id, {
                        nome: note.aluno.nome,
                        turma: note.aluno.turma,
                        totalTrend: 0,
                        count: 0
                    });
                }
                const s = studentsMap.get(note.aluno.id)!;
                s.totalTrend += trend;
                s.count++;
            });

            const movers = Array.from(studentsMap.values()).map(s => ({
                nome: s.nome,
                turma: s.turma,
                delta: Number((s.totalTrend / (s.count || 1)).toFixed(1))
            }))
                .filter(s => Math.abs(s.delta) >= 1)
                .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                .slice(0, 20);

            return { dados: movers, summary: undefined };
        }

        return { dados: [], summary: undefined };
    }, [slug, notasData, filters]);

    const isDerived = ["radar-abandono", "top-movers", "comparativo-eficiencia"].includes(slug || "");

    if (isDerived) {
        return {
            data: derivedData,
            isLoading: isLoadingNotas,
            isFetching: isLoadingNotas,
            isError: false
        };
    }

    return null;
};
