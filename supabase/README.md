# Supabase Database Structure

This directory contains all the SQL files needed to set up and maintain the Zendesk Clone database in Supabase.

## Directory Structure

```
supabase/
├── migrations/       # Database schema and table definitions
│   ├── 00_cleanup.sql         # Script to drop all objects
│   ├── 00_create_types.sql    # Create ENUM types first
│   ├── 01_create_tables.sql
│   ├── 02_create_indexes.sql
│   └── 03_create_views.sql
├── functions/       # PostgreSQL functions and triggers
│   ├── 01_triggers.sql
│   └── 02_ticket_functions.sql
└── policies/        # Row Level Security (RLS) policies
    ├── 01_auth_policies.sql
    ├── 02_ticket_policies.sql
    └── 03_comment_policies.sql
```

## Files Description

### Migrations
- `00_cleanup.sql`: Drops all database objects in the correct order
- `00_create_types.sql`: Creates all ENUM types needed by the database
- `01_create_tables.sql`: Creates all necessary tables
- `02_create_indexes.sql`: Creates indexes for performance optimization
- `03_create_views.sql`: Creates views for common queries

### Functions
- `01_triggers.sql`: Contains database triggers for automated operations
- `02_ticket_functions.sql`: Contains functions for ticket management

### Policies
- `01_auth_policies.sql`: RLS policies for user authentication and authorization
- `02_ticket_policies.sql`: RLS policies for ticket management
- `03_comment_policies.sql`: RLS policies for comment management

## Setup Order

When setting up the database from scratch:

1. (Optional) Run `migrations/00_cleanup.sql` to ensure a clean slate
2. `migrations/00_create_types.sql`
3. `migrations/01_create_tables.sql`
4. `migrations/02_create_indexes.sql`
5. `migrations/03_create_views.sql`
6. `functions/01_triggers.sql`
7. `functions/02_ticket_functions.sql`
8. `policies/01_auth_policies.sql`
9. `policies/02_ticket_policies.sql`
10. `policies/03_comment_policies.sql`

## Performance Considerations

- Indexes are created for columns used in:
  - Foreign key relationships
  - RLS policies
  - Frequent queries
- Views are used to optimize common queries
- Functions use SECURITY DEFINER when appropriate

## Security Best Practices

- RLS policies are enabled on all tables
- Functions that modify data use SECURITY DEFINER
- Policies follow the principle of least privilege
- All user actions are properly authenticated

## Maintenance

When making changes to the database:
1. Create new migration files with incremental numbers
2. Document changes in this README
3. Test policies thoroughly before applying to production
4. Consider impact on existing indexes and views
5. Update functions and triggers as needed

## Cleanup and Reset

To completely reset the database:
1. Run `00_cleanup.sql` to drop all objects
2. Follow the setup order above to recreate everything
3. Note: This will delete all data - use with caution in production 