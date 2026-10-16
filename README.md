# GradPath Homeschool

GradPath is an invite-only homeschool high-school planning app. Parents can keep separate student course records, track completed and planned credits by subject, enter percentage grades, adjust the family's letter-grade cutoffs, and print a progress report.

## Run locally

Serve the repository over HTTP from its root (the app fetches its state reference data):

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. Sign-in requires a configured Supabase project.

## Configure Supabase

1. Create a Supabase project and run [`supabase-schema.sql`](supabase-schema.sql) in its SQL Editor.
2. In Supabase Auth settings, disable public sign-ups and invite beta users through the Supabase dashboard. Configure the app URL and password-reset redirect URL to match the deployed site.
3. Copy the project's **Project URL** and **publishable/anon key** into `config.js`. Never put a service-role key in this browser app.
4. Deploy the static files to an HTTPS host. Before entering real student records, verify the database policies with separate test accounts and confirm one family cannot read or modify another family's records.

The schema enables row-level security on family, student, requirement, and course records. The `auth.users` trigger creates one family for each invited account. Keep public sign-ups disabled for the invite-only beta. When configured, the app loads the Supabase JavaScript client (v2.118.0) from `esm.sh`; the deployed site must be able to reach that CDN.

## State references

The included 50-state public-school credit profiles are based on the Education Commission of the States' May 2023 comparison of state statutes, regulations, and agency guidance: [High School Graduation Requirements 2023](https://reports.ecs.org/comparisons/high-school-graduation-requirements-2023-04). Where that comparison provides a state agency link, the app links to it; otherwise it links to the comparison.

This is a dated reference, not a live or authoritative homeschool requirements feed. Rules can change and may vary by diploma pathway, graduating class, or local district. Public-school credit requirements may not apply to homeschool families. Review the linked sources and edit each student's family plan; do not treat this app as legal advice.
