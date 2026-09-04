# Travel Experiences

Πλατφόρμα μεταφορών και επιλεγμένων ταξιδιωτικών εμπειριών για ταξιδιώτες, οδηγούς και operators.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/travel-experiences` — responsive customer, driver και admin web app.
- `artifacts/api-server/src/routes/travel.ts` — API handlers για εμπειρίες, quotes, bookings, jobs και driver review.
- `artifacts/api-server/src/routes/auth.ts` — Clerk profile και επιλογή ρόλου.
- `artifacts/api-server/src/lib/travel-data.ts` — seed data και κοινή λογική δυναμικής τιμολόγησης.
- `lib/api-spec/openapi.yaml` — source of truth για τα API contracts και τα generated hooks.
- `lib/db/src/schema/travel.ts` — Drizzle schema για experiences, bookings, driver jobs και drivers.
- `artifacts/travel-experiences/src/index.css` — κοινό visual theme και responsive styles.

## Architecture decisions

- Το API contract ορίζεται πρώτα στο OpenAPI και οι client/Zod τύποι παράγονται με Orval.
- Το MVP χρησιμοποιεί το προρυθμισμένο PostgreSQL και seed data για να είναι άμεσα εξερευνήσιμο.
- Η custom τιμολόγηση υπολογίζει βασική χρέωση, χιλιόμετρα, ώρες, vehicle multiplier, passenger adjustment και platform fee 18%.
- Τα payments, maps και live tracking παραμένουν επόμενα integrations. Η authentication ροή χρησιμοποιεί ήδη Replit-managed Clerk, ενώ το κινητό είναι υποχρεωτικό contact field για κρατήσεις και WhatsApp/Viber links.

## Product

- Η online εφαρμογή χρησιμοποιεί Replit-managed Clerk με cookie-based sessions. Οι ρόλοι αποθηκεύονται σε Clerk `publicMetadata.role`.
- Η επιλογή Operator είναι διαθέσιμη στο MVP/demo· σε production χρειάζεται controlled provisioning ή έγκριση admin.

- Οι ταξιδιώτες ανακαλύπτουν curated experiences, φτιάχνουν custom διαδρομή με quote και δημιουργούν κράτηση με προκαταβολή ή εξόφληση.
- Οι οδηγοί βλέπουν διαθέσιμες δουλειές και μπορούν να κάνουν claim με το όχημά τους.
- Οι operators βλέπουν φακέλους συνεργατών και εγκρίνουν ή απορρίπτουν αιτήσεις.
- Υπάρχει αυτόνομη offline έκδοση στο `exports/aperion-travel-experiences.html` για λήψη και άνοιγμα με διπλό κλικ.
- Η custom κράτηση διατηρεί ημερομηνία, ώρα, παραλαβή, επιβάτες και επιλογή προκαταβολής ή πλήρους εξόφλησης.

## User preferences

- Όλες οι απαντήσεις προς τον χρήστη και το UI πρέπει να είναι στα ελληνικά.

## Gotchas

- Τα `/api/me` και `/api/me/role` περιγράφονται στο OpenAPI και τα client/hooks παράγονται μαζί με τα υπόλοιπα API contracts.
- Το `format: email` στο OpenAPI παράγει `zod.email()` που δεν υποστηρίζεται από την τρέχουσα Zod έκδοση· για nullable profile emails κρατάμε `type: string` χωρίς format.

- Μετά από αλλαγές στο `lib/api-spec/openapi.yaml` πρέπει να τρέχει codegen πριν χρησιμοποιηθούν τα generated hooks.
- Η τρέχουσα έκδοση Zod δεν υποστηρίζει το παραγόμενο `zod.int()`, επομένως τα integer πεδία του OpenAPI δηλώνονται ως number και γίνεται στρογγυλοποίηση στο boundary όπου χρειάζεται.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
