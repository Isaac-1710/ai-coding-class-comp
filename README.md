# GradPath Homeschool

GradPath is a browser-based homeschool high-school planner. Track multiple students, customize graduation requirements and grade cutoffs, record courses and grades, and print or save a progress report.

## Use the live app

Open [GradPath Homeschool](https://isaac-1710.github.io/ai-coding-class-comp/). No account or backend setup is required.

## Data and privacy

GradPath saves family records in the browser's local storage on the device where you use it. The data is not uploaded to a server, shared with other devices, or protected by an account login. Anyone with access to that browser profile may be able to use the app and see its records. Clearing browser data or changing browsers/devices can remove or make the records unavailable. Print or save reports regularly if you need a separate copy.

## Run locally

Serve the repository over HTTP from its root because the app fetches the state reference data:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## State references

The included 50-state public-school credit profiles are based on the Education Commission of the States' May 2023 comparison of state statutes, regulations, and agency guidance: [High School Graduation Requirements 2023](https://reports.ecs.org/comparisons/high-school-graduation-requirements-2023-04). Where that comparison provides a state agency link, the app links to it; otherwise it links to the comparison.

This is a dated reference, not a live or authoritative homeschool requirements feed. Rules can change and may vary by diploma pathway, graduating class, or local district. Public-school credit requirements may not apply to homeschool families. Review the linked sources and edit each student's family plan; do not treat this app as legal advice.
