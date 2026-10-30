YottaFlex AI Prompt History
The prompts below show how I approached the project, from understanding the assignment and planning the data to implementing the workflow, improving the interface, and checking the final result.
Starting with the assignment

Prompt 1

I received this YottaFlex project assignment, but before I start coding, I want to understand what they are actually expecting. Can you read the problem statement and explain it in simple words? Tell me what problem the system is supposed to solve, who will use it, and what a successful final application should be able to do.

Prompt 2

I understand the basic idea now. Can you walk me through one realistic example of how a lead would enter the system, get evaluated, move to the next stage, and eventually become an opportunity? I want to understand the complete flow before deciding how to build it.

Prompt 3

I know some Python and basic frontend and backend development. Based on the requirements, suggest a practical technology stack that I can manage and explain in an interview. Also explain what each technology will be responsible for and how the frontend, backend, and database will communicate.

Prompt 4

Before we begin implementation, can you break the assignment into smaller development stages? Put the important requirements first and separate must-have features from improvements that can wait. I want a clear plan that we can follow one step at a time.
Understanding the data and business rules
Prompt 5

Let's work out the data model before writing code. What main records do we need for companies, contacts, leads, campaigns, activities, tasks, sales representatives, opportunities, and stage history? Explain how they are connected and why each relationship is needed.

Prompt 6

The assignment gives expected data volumes. Help me plan a realistic dataset with 5,000 companies, 10,000 contacts, 20,000 leads, and 3,000 opportunities. I also want the data to have believable relationships instead of generating unrelated random rows.

Prompt 7

I don't want every generated record to look perfect. What real sales situations should the sample data include, such as duplicate contacts, old leads, opted-out contacts, leads with high scores that never convert, or opportunities with missing history? Suggest cases that help demonstrate whether our business rules work.

Prompt 8

How should we calculate a lead score using fit, intent, and engagement? The assignment gives these three factors, so help me define a clear formula with weights of 50%, 30%, and 20%. I also want users to understand why a lead received its score.

Prompt 9

Let's define the rules for assigning leads to sales representatives. How should territory and product specialization affect assignment? Also explain what should happen when no suitable representative is available, so the system does not silently assign a lead to the wrong person.

Prompt 10

Before we generate the data, help me decide how to handle consent and lead progression. For example, an opted-out contact should not be contacted, and a converted lead should not keep changing its historical score. Explain the rules and the records we should keep for traceability.
Planning and building the data foundation
Prompt 11

Now that we understand the entities and rules, suggest a clean project folder structure. Keep it practical for this project and separate data generation, business logic, validation, database work, application code, documentation, and tests.

Prompt 12

I want the generated data to be repeatable so that we can test the same scenarios again. Help me design a seeded data generator using the fixed seed 20261022. It should create consistent records and preserve the relationships between companies, contacts, leads, and opportunities.

Prompt 13

Let's build the generator in small steps. Start with companies, contacts, and leads. Make sure the IDs follow a consistent format and that every relationship points to a valid record. Explain the important decisions as you implement them.

Prompt 14

Now extend the generator to create opportunities, activities, tasks, and stage history. Please keep the existing generated data and ID conventions consistent. Don't rewrite working parts just to add the remaining entities.

Prompt 15

How can we check the generated data before using it in the application? Add validation for missing references, duplicate IDs, invalid relationships, incorrect dates, and records that break the business rules. I want useful error messages rather than a simple pass or fail.

Prompt 16

Let's keep the intentionally incorrect business cases separate from normal sample records where possible. I want a clear way to identify the expected anomaly, the related record, and the reason it should be flagged. This will help us demonstrate that the system can detect real issues.
Connecting the application and implementing the workflow
Prompt 17

Based on the project structure and data model, help me plan the backend API. Which endpoints do we need for the dashboard, leads, lead details, opportunities, tasks, activities, and data-quality alerts? Keep the API focused on the actual workflow rather than adding endpoints we don't need.

Prompt 18

I want to understand how the database connection should work before we connect everything. Explain how PostgreSQL through Supabase will fit into this project, what connection details belong on the backend, and how we should keep credentials out of the frontend and GitHub.

Prompt 19

Let's connect the lead list to the actual data. I need search, filters, pagination, and a way to open an individual lead. Please make sure the values shown in the interface come from the selected data source and are not hardcoded examples.

Prompt 20

When a user changes a lead's status, should we create another lead record or update the existing one? I think the existing record should be updated while the previous and new stages are recorded separately. Help me implement that flow and explain how the dashboard counts should behave.

Prompt 21

Now let's work on follow-up tasks and activities. A user should be able to understand what needs to be done for a lead and what has already happened. Keep the relationship to the correct lead and make sure the activity history is not lost when the lead moves to another stage.

Prompt 22

Help me connect opportunities to the leads that created them. I want to see the current pipeline stage, the value of each opportunity, and the progress of deals. Please make sure the totals and stage counts are calculated from the records.
Making the application useful and checking the results
Prompt 23

Let's review the dashboard from the point of view of a sales manager. Which numbers actually help them make decisions? I want the dashboard to show useful lead score distribution, follow-up status, and opportunity progress, not just a collection of attractive cards.

Prompt 24

I want the score distribution and opportunity stage cards to be interactive. When someone clicks a number or category, the application should show the matching records. Plan the behavior first, then implement it without disturbing the existing navigation.

Prompt 25

Some screens are starting to look like internal developer tools rather than a CRM. Can you review the wording and presentation of these sections? Replace unclear technical labels with business-friendly explanations, but keep the underlying functionality and important information.

Prompt 26

Please review the lead details screen. When I open a lead, I should be able to understand its company, contact, owner, score breakdown, consent, routing, current stage, and history without searching through several hidden sections. Suggest the smallest changes needed to make this clear.

Prompt 27

I noticed that some dashboard values and currency formats are confusing. Check what the numbers actually represent before changing the display. Use consistent Indian currency formatting for large values, and don't show a metric such as win rate unless the underlying data supports it.

Prompt 28

Navigation between screens feels slow. Can you investigate where the delay is coming from before changing anything? Check whether we are repeatedly loading CSV data, making unnecessary database requests, or reconnecting to Supabase. Explain the cause and suggest the safest fix.

Prompt 29

Before making a major change, tell me what files and behavior it could affect. I don't want a full rewrite or a database reset at this stage. Make the change in a controlled way, preserve the existing data and working scenarios, and run the relevant tests afterwards.

Prompt 30

Let's do a final review against the original assignment. Check whether the main workflow, data volumes, scoring, consent rules, assignment, opportunity tracking, anomaly handling, and traceability are covered. Give me only the genuine gaps and the changes that are important before submission.