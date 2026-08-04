---
# Product Requirements Document
## AltStack
**Version:** 1.0
**Status:** Draft
---

# Overview

## What is AltStack?

AltStack is a modern platform for discovering, exploring, and showcasing open-source software.

It helps developers find quality projects while giving maintainers a place to present their work to thousands of developers.

Unlike traditional directories, AltStack focuses on project discovery, quality, curation, and developer experience.

---

# Vision

Become the best place to discover modern open-source software.

Think:

- GitHub × Product Hunt × OpenAlternative

without becoming another software listing website.

---

# Mission

Help developers discover software they'll actually use.

Help maintainers get visibility.

Create an ecosystem around open-source projects.

---

# Problem

Today developers discover software from:

- GitHub
- Reddit
- Twitter/X
- Hacker News
- Product Hunt
- Awesome Lists

The experience is fragmented.

GitHub isn't designed for discovery.

Product Hunt isn't focused on open source.

Awesome Lists become outdated.

Most directories are static and ugly.

---

# Solution

A beautiful platform where developers can

- discover software
- compare projects
- browse by category
- follow trending projects
- submit their own project
- save favorites
- build collections

---

# Target Users

## Explorer

Developers looking for tools.

Examples

- "Need auth library"
- "Need AI framework"
- "Need deployment platform"

---

## Builder

Open source maintainers.

Goals

- showcase project
- get users
- collect feedback
- increase GitHub visibility

---

## Curators

People creating lists.

Examples

Best AI Coding Tools

Best Self Hosted Apps

Best React Libraries

---

# Goals

## MVP

Allow users to

- Discover
- Search
- Filter
- View project
- Submit project

---

Future

Become the homepage for discovering open-source software.

---

# Core Features

---

## Discover

Homepage

Sections

- Trending

- New

- Editor's Picks

- Recently Updated

- Fast Growing

- Most Starred

---

## Search

Search by

- project name

- description

- tags

- maintainer

- company

Instant search.

---

## Categories

Examples

- AI

- Developer Tools

- Productivity

- Design

- Database

- DevOps

- Monitoring

- Security

- CMS

- Self Hosted

- Backend

- Frontend

- Mobile

- CLI

---

## Collections

Example

Best Open Source AI Apps

Best Authentication Solutions

Awesome Self Hosted Apps

Modern React Ecosystem

---

## Project Page

Contains

Header

Logo

Name

Description

Website

GitHub

License

Categories

Tags

---

Overview

Screenshots

Video

Features

Installation

Tech Stack

Alternatives

Similar Projects

Maintainer

Contributors

Stats

---

GitHub Stats

Stars

Forks

Watchers

Issues

Contributors

Last Commit

License

Created

Updated

---

Links

Website

GitHub

Discord

Docs

Demo

Twitter

Blog

---

## Submit Project

Anyone can submit.

Required

- GitHub Repository

- Website (optional)

- Description

- Logo

- Categories

System auto-fetches

- stars

- forks

- README

- license

- owner

- topics

---

## Claim Ownership

Maintainer logs in with GitHub.

Verifies ownership.

Can edit

- screenshots

- description

- links

- videos

---

## Bookmark

Users save favorite software.

Collections

Favorites

Wishlist

Currently Using

Want To Try

---

## Compare

Example

Coolify vs Dokploy

Supabase vs Appwrite

Clerk vs Better Auth

Feature comparison table.

---

# Quality Score

Instead of only GitHub Stars.

AltStack Score

Calculated from

- Stars

- Growth

- Recent Releases

- Issue Activity

- Documentation

- Community

- Contributors

- Maintenance

---

# Home Feed

Trending

Fast Growing

Recently Updated

Editor's Picks

Community Picks

Hidden Gems

---

# Authentication

GitHub OAuth

Future

Google

Email

---

# Roles

Guest

User

Maintainer

Moderator

Admin

---

# Admin Dashboard

Approve submissions

Reject spam

Manage categories

Manage collections

Feature projects

Analytics

---

# Tech Stack

## Runtime & Toolchain

- Bun

- Vite+ (`vp`)

---

## Frontend

- React 19

- TanStack Start & TanStack Router

- TanStack Query

- TailwindCSS v4

- shadcn/ui

---

## Backend

- TanStack Start / Nitro (Fetch Handlers)

- oRPC

- Drizzle ORM

- PostgreSQL (via `pg`)

---

## Search

- PostgreSQL Full Text Search (MVP)

- Meilisearch (Future)

---

## Authentication

- Better Auth

---

## File Storage

- Cloudflare R2

---

## Image Optimization

- Cloudflare Images

---

## Deployment

- Docker

- Coolify

- Dokploy

---

# Database

Core Models

```
User

Project

ProjectImage

Category

Tag

Collection

Bookmark

Review

Vote

Maintainer

GitHubRepository

Release
```

---

# Future Features

Developer Profiles

Follow Maintainers

Reviews

Ratings

Roadmaps

API

Public SDK

Browser Extension

VSCode Extension

CLI

Newsletter

Trending Weekly

Launches

RSS

AI Recommendations

GitHub Sync

---

# Non Goals

Not another GitHub.

Not another Product Hunt.

Not another package manager.

Not another social media.

---

# Success Metrics

- Number of projects
- Monthly active users
- Search usage
- Submitted projects
- Claimed projects
- Returning visitors
- Average session duration

---

# Long-Term Vision

AltStack becomes the place developers open when they think:

> "i need a tool for this."

Instead of searching Google or GitHub first, they search AltStack.

---
