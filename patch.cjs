const fs = require('fs');
let code = fs.readFileSync('services/supabaseService.ts', 'utf8');

// Replace getSurveyForDepartment
code = code.replace(
`    async getSurveyForDepartment(deptId: string): Promise<SurveyEntry | null> {
        const { data } = await supabase.from('survey_submissions').select('*').eq('department_id', deptId).maybeSingle();
        if (!data) return null;
        return {
            id: data.id,
            departmentId: data.department_id,
            submittedAt: data.submitted_at,
            quantities: data.quantities as any
        };
    },`,
`    async getSurveyForDepartment(deptId: string, fiscalYear: number): Promise<SurveyEntry | null> {
        const { data } = await supabase.from('survey_submissions').select('*').eq('department_id', deptId).maybeSingle();
        if (!data || !data.quantities) return null;
        let q = data.quantities as any;
        const keys = Object.keys(q);
        if (keys.length > 0 && keys[0].length > 4) {
             // Old format, assume current year
             q = { [fiscalYear]: q };
        }
        if (!q[fiscalYear]) return null;
        return {
            id: data.id,
            departmentId: data.department_id,
            submittedAt: data.submitted_at,
            quantities: q[fiscalYear]
        };
    },`
);

// Replace submitSurvey
code = code.replace(
`    async submitSurvey(deptId: string, quantities: any) {
        const { data: existing } = await supabase.from('survey_submissions').select('id').eq('department_id', deptId).maybeSingle();
        if (existing) {
            const { error } = await supabase.from('survey_submissions').update({ quantities, submitted_at: new Date().toISOString() }).eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error = null } = await supabase.from('survey_submissions').insert({ department_id: deptId, quantities, submitted_at: new Date().toISOString() });
            if (error) throw error;
        }`,
`    async submitSurvey(deptId: string, fiscalYear: number, newQuantities: any) {
        const { data: existing } = await supabase.from('survey_submissions').select('id, quantities').eq('department_id', deptId).maybeSingle();
        let quantities = existing?.quantities || {};
        const keys = Object.keys(quantities);
        if (keys.length > 0 && keys[0].length > 4) {
             quantities = { [fiscalYear]: quantities };
        }
        quantities[fiscalYear] = newQuantities;
        
        if (existing) {
            const { error } = await supabase.from('survey_submissions').update({ quantities, submitted_at: new Date().toISOString() }).eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error = null } = await supabase.from('survey_submissions').insert({ department_id: deptId, quantities, submitted_at: new Date().toISOString() });
            if (error) throw error;
        }`
);

fs.writeFileSync('services/supabaseService.ts', code);
