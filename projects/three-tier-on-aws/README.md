# Three-tier app on AWS — starter

This workbench grades **your Terraform plan**, so the review needs no credentials,
no spend, and no live account.

1. Build the stack in your own repo.
2. Export the plan into this workbench:

       terraform plan -out=tfplan && terraform show -json tfplan > artifact/plan.json

3. Run the checks:

       bun test

`src/plan.ts` is the grader; you do not edit it. The `artifact/plan.json` that ships
here is the plan almost everyone produces first: one availability zone, a publicly
accessible database with no encryption and no backups, SSH and Postgres open to
`0.0.0.0/0`, an `Action:* Resource:*` IAM policy, a bucket with no public-access
block, an HTTP-only listener, and the database password sitting in the plan as a
literal. The suite fails until your plan replaces it.

The grader reads both plan shapes (`planned_values` with nested `child_modules`, and
`resource_changes`) and all three security-group styles Terraform accepts, because a
checker that only understands one of them is a checker you can accidentally pass.

**What a plan cannot prove**, and you still owe on the project page: that the stack
applies from a clean account, that remote state and locking work, that the app boots
behind the load balancer and can reach the database, and that a destroy/apply cycle
reproduces the environment. Do those with the real account — this suite only
guarantees you will not page yourself over a public database.
