# Three-Tier App on AWS, by IaC

Stand up a real three-tier system on AWS — a load balancer in front, a compute tier in the middle, a managed Postgres behind it, and S3 for objects — entirely from code you can re-run. The point isn't to click through a console once; it's to express the whole topology, its IAM, and its network boundaries as Terraform (or CDK) you could hand to a teammate, destroy, and recreate byte-for-byte. This is the project where 'infrastructure' stops being a pile of consoles and becomes a reviewable artifact.

**Difficulty:** advanced · **Est. days:** 9 · **Stack:** aws, terraform (or aws-cdk), ecs/fargate or ec2 + asg, rds postgres, s3, application load balancer · **Tracks:** aws, docker, security-cloud

## Deliverable

A Terraform (or CDK) repo that, from a clean account, provisions a VPC with public/private subnets, an Application Load Balancer, a compute tier (ECS/Fargate or an ASG), an RDS Postgres instance in private subnets, and an S3 bucket — wired with least-privilege IAM and useful stack outputs (the ALB DNS name, the DB endpoint) — that you can apply and destroy on demand.

## Why this project

Almost every system you'll deploy as a senior is some version of this shape: a load balancer, a compute tier, a managed database, and a bucket — glued together by a network you designed and IAM you scoped. Building it once from code, then proving you can destroy and recreate it, is how 'cloud infrastructure' stops being a console you're afraid to touch and becomes something you reason about in a diff. The hard parts aren't the resources; they're the boundaries — which subnet, which security group, which permission, which endpoint is private. Get those right and you can hand the repo to anyone. Get them wrong and you've built the exact misconfiguration that ends up in a breach report. That gap, between a stack that runs and a stack that's safe to run, is the whole job.

## Skills

- modelling a VPC with public/private subnet tiers
- writing Terraform/CDK for ALB + compute + RDS + S3
- scoping least-privilege IAM roles and policies
- managing remote Terraform state and outputs
- putting a database in a private subnet and reaching it safely
- tearing down and recreating an environment deterministically

## Milestones

### 1. Lay the network

Everything else hangs off the network, so build it first and build it honestly. Define a VPC with at least two availability zones, public subnets for the load balancer and private subnets for compute and the database. Add an internet gateway for the public side and a NAT path (gateway or instance) so private workloads can reach out without being reachable from the internet. Resist the temptation to drop everything in public subnets 'to make it work' — the public/private split is the whole security story of this project, and getting routing tables right now saves you from confusing connection-refused mysteries later. Express it all in code so the topology is a diagram you can read in the diff.

**Definition of done:**

- terraform apply (or cdk deploy) creates a VPC with public and private subnets across at least two AZs, plus IGW and a NAT path.
- A host launched in a private subnet can reach the internet outbound but is not reachable inbound from the internet.

### 2. Make the stack re-runnable

Infrastructure you can't recreate is a liability, not an asset. Set up remote state (an S3 backend with a lock table, or CDK's managed state) so two people — or two machines — don't stomp each other's changes. Split your config into modules or constructs by tier (network, compute, data) so the blast radius of an edit is obvious. Then prove the contract: run apply, run destroy, run apply again, and confirm you land in the same place. This loop is the difference between IaC as a habit and IaC as a screenshot — once destroy-then-apply is boring, you actually trust the code.

**Definition of done:**

- State lives remotely with locking; a second apply with no changes reports zero diffs.
- A full destroy followed by a fresh apply rebuilds the stack without manual console fixups.

### 3. Compute behind a load balancer

Now put work in the middle tier and only expose it through the front door. Run your app as an ECS/Fargate service (or an EC2 Auto Scaling group) in the private subnets, and place an Application Load Balancer in the public subnets to terminate inbound traffic and health-check the targets. The compute tier should accept connections only from the ALB's security group — not from the world — so the load balancer is the single, observable entry point. Wire up a target group and a health check that actually reflects readiness, because an ALB that marks a half-booted task healthy will happily route users into errors.

**Definition of done:**

- Hitting the ALB DNS name returns a response from a compute task running in a private subnet.
- The compute security group rejects direct connections and accepts traffic only from the ALB.

### 4. Managed database and object storage

Give the app real state: an RDS Postgres instance living in the private subnets, never on a public IP, reachable only from the compute security group on the database port. Keep credentials out of your code — pull them from Secrets Manager or SSM Parameter Store, not a hardcoded string in a tfvars file. Add an S3 bucket for object storage with public access blocked and encryption on by default. The lesson here is that 'managed' doesn't mean 'safe by default': an RDS instance with a public endpoint or an S3 bucket with block-public-access off is exactly how data leaks make the news. Treat the secure posture as part of the deliverable, not a follow-up ticket.

**Definition of done:**

- The compute tier connects to RDS Postgres using a secret from a secrets store; the DB has no public endpoint.
- The S3 bucket blocks public access and has default encryption enabled, verified in the plan and the console.

### 5. Least-privilege IAM and outputs

An admin-everything role is a tutorial smell; production runs on the narrowest permissions that still work. Give the compute task an execution role scoped to exactly what it needs — read this one secret, put objects in this one bucket prefix, write logs to this one log group — and nothing wildcard. Then surface the seams the rest of the world depends on as stack outputs: the ALB DNS name, the RDS endpoint, the bucket name. Outputs are the public API of your stack; anything a deployer or a downstream stack needs should come out the front, not be dug out of the console. Tighten the policies until an over-broad action would break something real, and you'll feel where the actual boundaries are.

**Definition of done:**

- The compute role grants only the specific secret, bucket, and log permissions the app uses — no wildcard '*' on resources or actions.
- terraform output (or CDK outputs) prints the ALB DNS name, the RDS endpoint, and the bucket name.

### 6. Ship it for real: blue/green, cost, or serverless

A stack that exists isn't a stack you can operate. Pick the seam that matters most and close it. Option one: add a blue/green deployment so a new version goes live behind the ALB only after its target group is healthy, with an instant rollback path — no more 'deploy and pray'. Option two: write a cost note that prices the always-on pieces (NAT gateway, RDS, ALB hours add up fast) and proposes where a serverless variant — Lambda behind API Gateway, Aurora Serverless or DynamoDB — would cut idle spend, with the tradeoff stated honestly. Either way you're answering the question every senior gets asked after the demo: 'what does this cost to keep running, and how do we change it without downtime?'

**Definition of done:**

- Either a documented blue/green (or canary) deploy that shifts traffic only after health checks pass, or a written cost breakdown with a concrete serverless alternative and its tradeoff.
- The chosen path is reproducible from the IaC repo, not a one-off manual change in the console.

## Rubric

### VPC and subnet design

- **Junior:** A VPC and subnets exist, but compute and the database are in the same tier or in public subnets. The routing table allows inbound from the internet to the database. The design works but the public/private split that the whole security story depends on is absent.
- **Mid:** Public subnets hold only the ALB (and NAT gateway); compute and RDS are in private subnets with no public IPs. A host in a private subnet can reach the internet outbound via NAT but is unreachable inbound. Security groups enforce that the compute tier accepts traffic only from the ALB SG, and the DB accepts traffic only from the compute SG.
- **Senior:** You reason about the blast radius of each layer: if the web tier is compromised, the attacker reaches the compute SG but not the database (compute-to-db rule is the only path). You identify the failure mode of a 'too-permissive-for-now' security group rule that someone added during debugging and never removed — it widens the blast radius silently. You propose a tfsec or AWS Config rule that would flag such a regression at plan time.

### IaC reproducibility and state management

- **Junior:** Infrastructure is defined in Terraform or CDK but state is local. A second `apply` on a different machine would create duplicate resources or fail. The destroy/apply cycle has not been tested.
- **Mid:** State is remote (S3 backend + DynamoDB lock table, or CDK managed state). A full destroy followed by a fresh apply reproduces the identical stack. Stack outputs (ALB DNS, RDS endpoint, bucket name) are defined in the IaC so downstream consumers never dig through the console.
- **Senior:** You reason about what 'identical' means across apply cycles: resources with `create_before_destroy` replace without downtime; resources without it cause a brief outage. You identify which resources in this stack (RDS, the ECS service) need lifecycle rules and which can be naively replaced. You describe how a drift between console state and IaC state (a manual console edit) would surface in the next `terraform plan` and how you'd reconcile it.

### Least-privilege IAM and secrets handling

- **Junior:** The ECS task role has broad permissions ('s3:*' or 'secretsmanager:*'). Database credentials are in an environment variable hardcoded in the task definition, not fetched from a secrets store.
- **Mid:** The task execution role grants only the specific secret ARN, bucket prefix, and log group the app uses — no wildcard on resource or action. Database credentials are fetched at runtime from Secrets Manager or SSM. The S3 bucket blocks public access and has default encryption. RDS has no public endpoint.
- **Senior:** You reason about what a compromised ECS task can do given its role: read exactly one secret, write to exactly one bucket prefix, write logs. You identify the next lateral-movement step for an attacker who steals the task's instance metadata credentials: they can call the same three APIs from anywhere on the internet, not just from within the VPC — which is why VPC endpoint conditions on IAM policies (aws:SourceVpc) close that gap. You state whether this stack implements that condition and why or why not.

### Multi-AZ placement and failure mode

- **Junior:** Resources exist but are in a single AZ. An AZ failure takes the entire stack down. RDS has no Multi-AZ standby. Subnets span only one availability zone.
- **Mid:** Subnets exist in at least two AZs. ECS or ASG spreads tasks/instances across AZs. RDS has a Multi-AZ standby. An AZ outage causes a brief failover (60-120 s for RDS) rather than total downtime. The ALB target group routes only to healthy AZs automatically.
- **Senior:** You reason about the cost of multi-AZ: a Multi-AZ RDS instance is ~2× the price of a single-AZ instance, a second NAT gateway in the second AZ doubles NAT cost, and ECS tasks in two AZs may idle. You compare this to the cost of downtime (SLA breach, lost revenue, recovery labor) and state when the break-even makes multi-AZ worth it versus when a single-AZ deployment with a fast snapshot-restore is an acceptable tradeoff for a smaller app.

## Senior stretch

- Add a CI pipeline that runs terraform plan on every pull request and posts the diff, so infrastructure changes get reviewed like code instead of applied from a laptop.
- Make the stack multi-AZ end to end — RDS with a standby in a second zone, compute spread across AZs — and document the failover behaviour you'd expect when one zone goes dark.
- Run a policy check (tfsec, Checkov, or AWS Config rules) against the stack and fix or justify every finding, turning 'looks secure' into 'passes an automated audit'.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/three-tier-on-aws
