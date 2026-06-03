# FixFlow-AI Web Project Guidelines

Welcome to the **FixFlow-AI** project! As this project is built for teams and group projects, collaboration is at the heart of what we do. 

This document serves as the **single source of truth** for all guidelines, instructions, policies, and rules for anyone contributing to or participating in the FixFlow-AI project. By interacting with this repository, you agree to abide by the rules and policies outlined below.

---

## 📚 Table of Contents
1. [Code of Conduct](#1-code-of-conduct)
2. [Security Policies and Rules](#2-security-policies-and-rules)
3. [Contributor Guidelines](#3-contributor-guidelines)
4. [GitHub Organization Rules & Permissions](#4-github-organization-rules--permissions)

---

## 1. Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free experience for everyone, regardless of gender, sexual orientation, disability, physical appearance, body size, race, or religion.

### Our Standards
- **Be respectful and professional:** Avoid using offensive language, personal attacks, or exclusionary jokes.
- **Be collaborative:** We are a team. Help others, ask questions, and share knowledge.
- **Be constructive:** Provide actionable feedback during code reviews and accept constructive criticism gracefully.
- **Focus on what is best for the community:** Put the project and community first.

### Unacceptable Behavior
- Trolling, insulting/derogatory comments, and public or private harassment.
- Publishing others' private information without explicit permission.
- Any other conduct which could reasonably be considered inappropriate in a professional setting.

### Reporting
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the project administrators by emailing **admin@fixflow.ai** (placeholder email - please reach out to maintainers directly via GitHub issues if this email is unavailable). All complaints will be reviewed and investigated and will result in a response that is deemed necessary and appropriate to the circumstances.

---

## 2. Security Policies and Rules

Security is a top priority for FixFlow-AI. We take all vulnerabilities seriously and appreciate the community's help in keeping our project secure.

### Reporting a Vulnerability
- **Do NOT open a public issue.** 
- If you discover a security vulnerability, please send an email to the security team at **security@fixflow.ai** or use GitHub's private vulnerability reporting feature under the "Security" tab of this repository.
- Provide detailed steps to reproduce the vulnerability. We will acknowledge receipt of your vulnerability report and strive to send you regular updates about our progress.

### Security Rules
- **No Secrets in Code:** Never commit passwords, API keys, tokens, or any other sensitive information. Use environment variables and `.env` files (which must be added to `.gitignore`).
- **Dependencies:** Regularly audit dependencies for known vulnerabilities (e.g., using `npm audit` or `Dependabot`).
- **Sanitization:** Always sanitize and validate user input to prevent SQL injection, XSS, and other common vulnerabilities.
- **Least Privilege:** Applications and services should run with the minimum permissions necessary to function.

---

## 3. Contributor Guidelines

We love pull requests from everyone! Here’s how you can contribute:

### Getting Started
1. **Fork the repository** and clone it locally.
2. **Set up the development environment:** Follow the instructions in the `README.md` to install dependencies (e.g., `npm install`).
3. **Find an issue:** Look for issues tagged with `good first issue` or `help wanted`.

### Branching Strategy
- **`main`:** The primary branch. It must always be stable and deployable.
- **Feature Branches:** Create a new branch for each feature or bug fix.
  - Format: `feature/your-feature-name` or `fix/your-fix-name` or `docs/update-readme`

### Commit Message Conventions
We follow [Conventional Commits](https://www.conventionalcommits.org/). This leads to more readable messages that are easy to follow when looking through the project history.
- `feat:` A new feature.
- `fix:` A bug fix.
- `docs:` Documentation only changes.
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
- `refactor:` A code change that neither fixes a bug nor adds a feature.
- `test:` Adding missing tests or correcting existing tests.
- `chore:` Changes to the build process or auxiliary tools and libraries such as documentation generation.

### Pull Request Process
1. **Keep it focused:** Submit one PR per feature or bug fix.
2. **Write tests:** Ensure that your code is covered by tests.
3. **Update documentation:** If you change behavior, update the relevant documentation.
4. **Pass CI:** Ensure all continuous integration checks pass (linting, testing, formatting).
5. **Code Review:** At least one project maintainer must approve the PR before it can be merged. Address any feedback provided during the review.

---

## 4. GitHub Organization Rules & Permissions

To maintain order, security, and quality across the FixFlow-AI organization, the following rules apply to all repositories and members:

### Roles and Permissions
- **Admin/Owner:** Full access to manage the repository, including settings, secrets, and branch protection rules.
- **Maintainer:** Can push to protected branches, manage issues/PRs, and configure repository settings.
- **Developer/Write Access:** Can push to standard branches, create PRs, and review code. Cannot push directly to `main` without a PR.
- **Triage:** Can manage issues and PRs (labels, milestones) but cannot push code.
- **Read:** Can clone the repository and open issues/PRs (for public or standard internal repos).

### Repository Rulesets
1. **Branch Protection:** 
   - Direct pushes to `main` are disabled. 
   - All changes must be made via Pull Requests.
   - Require status checks to pass before merging.
   - Require at least 1 approving review from someone with Write access or higher.
2. **Issue Management:**
   - Issues should be clearly labeled (e.g., `bug`, `enhancement`, `documentation`).
   - Assign issues to yourself if you are working on them to prevent duplicated effort.
3. **Stale Issues and PRs:**
   - Issues and PRs inactive for 30 days will be marked as stale and may be closed if no further activity occurs.

Thank you for contributing to FixFlow-AI! Together, we can build something amazing.
