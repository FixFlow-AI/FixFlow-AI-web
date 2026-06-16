# Contributing to FixFlow-AI

Thank you for your interest in contributing to **FixFlow-AI**! We welcome contributions from developers, designers, writers, and users of all skill levels. By contributing to this project, you agree to abide by our project guidelines and standards.

---

## 📚 Table of Contents

1. [Code of Conduct](#1-code-of-conduct)
2. [How Can I Contribute?](#2-how-can-i-contribute)
3. [Development Setup](#3-development-setup)
4. [Branching Strategy](#4-branching-strategy)
5. [Commit Conventions](#5-commit-conventions)
6. [Pull Request Process](#6-pull-request-process)
7. [Getting Help](#7-getting-help)

---

## 1. Code of Conduct

Our community is committed to providing a welcoming, inclusive, and harassment-free experience for everyone. Please read and adhere to Section 1 of our [Project Guidelines](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/GUIDELINES.md) to understand our expectations.

---

## 2. How Can I Contribute?

### Reporting Bugs
If you find a bug, please check the [GitHub Issues](https://github.com/) to see if it has already been reported. If not, open a new issue and include:
- A clear, descriptive title.
- Steps to reproduce the bug.
- Expected vs. actual behavior.
- Screenshots or log snippets if applicable.

> [!CAUTION]
> If you discover a security vulnerability, **do NOT open a public issue**. Refer to our Security Policies in [GUIDELINES.md](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/GUIDELINES.md#2-security-policies-and-rules) to report it privately.

### Suggesting Enhancements
We welcome feature ideas! Open an issue with the template description outlining:
- The user goal or problem you are trying to solve.
- A detailed description of the proposed feature.
- Any alternative solutions considered.

---

## 3. Development Setup

Follow these steps to set up a local development environment:

1. **Fork the Repository**: Create a personal fork on GitHub.
2. **Clone the Fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/FixFlowAI.git
   cd FixFlowAI
   ```
3. **Install Dependencies**:
   - Install root and frontend dependencies:
     ```bash
     npm install
     ```
   - Install backend dependencies:
     ```bash
     cd backend
     npm install
     ```
   - Install smart contract dependencies:
     ```bash
     cd ../contracts
     npm install
     ```
4. **Configure Environments**: Create `.env` files matching `.env.example` configurations in the respective folders.

---

## 4. Branching Strategy

To keep the repository clean and stable, please adhere to our branching strategy:

- **Primary Branch (`testing`)**: Always contains stable, deployable code. Do not push directly to `testing`.
- **Feature/Fix Branches**: Create short-lived branches from `testing`:
  - Features: `feature/your-feature-name`
  - Bug Fixes: `fix/your-bug-fix-name`
  - Documentation: `docs/updated-documentation-name`

---

## 5. Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature (e.g., `feat: add escrow milestone completion state`)
- `fix:` A bug fix (e.g., `fix: prevent token expired exception loop`)
- `docs:` Documentation updates (e.g., `docs: add contributing guidelines`)
- `style:` Formatting, semi-colons, white spaces (no logic changes)
- `refactor:` Code restructuring without changing functional behavior
- `test:` Adding or updating tests
- `chore:` Maintenance tasks, dependency updates, and build adjustments

---

## 6. Pull Request Process

1. **Keep it Focused**: A pull request should only address one issue or feature.
2. **Write & Run Tests**:
   - Run frontend and backend tests:
     ```bash
     npm run check
     ```
   - Run contract tests:
     ```bash
     cd contracts
     npx hardhat test
     ```
3. **Open the PR**: Targets the `testing` branch of the upstream repository.
4. **Pass Checks**: Ensure all CI status checks (linting, tests) pass.
5. **Code Review**: At least one maintainer review is required before merging. Address all feedback constructively.

---

## 7. Getting Help

If you have questions about the codebase, setup, or guidelines, feel free to ask a maintainer or start a discussion in the GitHub repository.

*Happy Coding!*
