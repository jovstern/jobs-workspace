import type { Job } from '@jobs-workspace/shared'

// A seed job as written by hand: everything except the content version, which seed.ts computes.
export type SeedJob = Omit<Job, 'contentVersion'>

// Nine hand-written software jobs at mixed levels. Every company is fictional. Job ids and
// requirement ids are hand-assigned and must never change: stored analyses and, from Phase 3,
// tracked applications are keyed by them (the ids are pinned in seed.test.ts). Each requirement
// is one clear posting sentence that names its skill; the model rates exactly this list and never
// invents one. The synthetic demo resume (e2e/fixtures/resumes/frontend-senior.txt) is written
// with these jobs: a near-perfect fit for job-frontend-senior and a poor fit for
// job-data-scientist-senior.
export const SEED_JOBS: readonly SeedJob[] = [
  {
    id: 'job-frontend-junior',
    title: 'Junior Frontend Developer',
    company: 'Larkspur Studio',
    level: 'Junior',
    location: 'Lisbon, Portugal (hybrid)',
    summary: [
      'Larkspur Studio makes booking tools for independent yoga and dance studios. You will join the web team to build and polish the screens studio owners use to manage classes.',
      'This is a first or second role. You will pair with a senior engineer every week, ship small changes from your first month, and learn how a production front end is built and tested.',
    ],
    requirements: [
      {
        id: 'fe-jr-r1',
        kind: 'required',
        skill: 'JavaScript',
        text: 'Solid JavaScript fundamentals: you can read and write modern JavaScript, including promises and array methods.',
      },
      {
        id: 'fe-jr-r2',
        kind: 'required',
        skill: 'HTML and CSS',
        text: 'Good working knowledge of semantic HTML and CSS, including responsive layouts.',
      },
      {
        id: 'fe-jr-r3',
        kind: 'required',
        skill: 'React',
        text: 'Some experience building interfaces with React, from a course, an internship or a personal project.',
      },
      {
        id: 'fe-jr-r4',
        kind: 'required',
        skill: 'Accessibility',
        text: 'Awareness of accessibility basics such as keyboard support, form labels and colour contrast.',
      },
      {
        id: 'fe-jr-r5',
        kind: 'required',
        skill: 'Testing',
        text: 'You have written a few automated tests for a front-end project, or are keen to learn how.',
      },
      {
        id: 'fe-jr-r6',
        kind: 'nice_to_have',
        skill: 'TypeScript',
        text: 'Some exposure to TypeScript.',
      },
      {
        id: 'fe-jr-r7',
        kind: 'nice_to_have',
        skill: 'Agile',
        text: 'Experience working in sprints with a small team, for example during an internship.',
      },
    ],
  },
  {
    id: 'job-frontend-senior',
    title: 'Senior Frontend Engineer',
    company: 'Brightwell Labs',
    level: 'Senior',
    location: 'Remote (Europe)',
    summary: [
      'Brightwell Labs builds planning tools for small logistics teams. You will own the web client that dispatchers use all day, from the route board to the shift calendar.',
      'You will work with two designers and four engineers, shape the component library, and set the bar for accessibility and speed across the product.',
    ],
    requirements: [
      {
        id: 'fe-sr-r1',
        kind: 'required',
        skill: 'React',
        text: 'Five or more years building production web applications with React, including hooks, context and component composition.',
      },
      {
        id: 'fe-sr-r2',
        kind: 'required',
        skill: 'TypeScript',
        text: 'Strong TypeScript: you model data with precise types and keep strict mode on in large codebases.',
      },
      {
        id: 'fe-sr-r3',
        kind: 'required',
        skill: 'Accessibility',
        text: 'Hands-on experience building accessible interfaces to WCAG 2.2, including keyboard support and screen reader testing.',
      },
      {
        id: 'fe-sr-r4',
        kind: 'required',
        skill: 'Testing',
        text: 'You write automated tests for the front end, from component tests to browser end-to-end tests.',
      },
      {
        id: 'fe-sr-r5',
        kind: 'required',
        skill: 'Performance',
        text: 'You measure and improve front-end performance, such as bundle size, rendering cost and Core Web Vitals.',
      },
      {
        id: 'fe-sr-r6',
        kind: 'required',
        skill: 'Design systems',
        text: 'Experience building or maintaining a shared design system or component library used by several teams.',
      },
      {
        id: 'fe-sr-r7',
        kind: 'nice_to_have',
        skill: 'GraphQL',
        text: 'Experience consuming GraphQL APIs from a client application.',
      },
      {
        id: 'fe-sr-r8',
        kind: 'nice_to_have',
        skill: 'Mentoring',
        text: 'You have mentored other engineers and enjoy helping a team raise its craft.',
      },
    ],
  },
  {
    id: 'job-backend-mid',
    title: 'Backend Engineer',
    company: 'Copperfield Payments',
    level: 'Mid',
    location: 'Remote (UK)',
    summary: [
      'Copperfield Payments moves money between small shops and their suppliers. You will build and run the services behind invoicing and payouts, where correctness matters more than novelty.',
      'You will join a team of five backend engineers, take on-call turns once you are settled in, and own features from design to production.',
    ],
    requirements: [
      {
        id: 'be-mid-r1',
        kind: 'required',
        skill: 'Java',
        text: 'Three or more years building backend services in Java or Kotlin on the JVM.',
      },
      {
        id: 'be-mid-r2',
        kind: 'required',
        skill: 'REST APIs',
        text: 'You design and document REST APIs that other teams rely on, including versioning and error handling.',
      },
      {
        id: 'be-mid-r3',
        kind: 'required',
        skill: 'PostgreSQL',
        text: 'Good PostgreSQL skills: schema design, indexing and reading query plans.',
      },
      {
        id: 'be-mid-r4',
        kind: 'required',
        skill: 'Testing',
        text: 'You write unit tests and integration tests, and keep them fast and reliable.',
      },
      {
        id: 'be-mid-r5',
        kind: 'required',
        skill: 'CI/CD',
        text: 'Experience with continuous integration and delivery pipelines, for example GitHub Actions.',
      },
      {
        id: 'be-mid-r6',
        kind: 'required',
        skill: 'Security',
        text: 'Working knowledge of API security, including authentication and the OWASP top ten.',
      },
      {
        id: 'be-mid-r7',
        kind: 'nice_to_have',
        skill: 'Docker',
        text: 'Experience packaging services with Docker.',
      },
      {
        id: 'be-mid-r8',
        kind: 'nice_to_have',
        skill: 'Observability',
        text: 'Experience with monitoring and tracing in production, for example with Grafana.',
      },
    ],
  },
  {
    id: 'job-backend-staff',
    title: 'Staff Backend Engineer',
    company: 'Northgate Freight Systems',
    level: 'Staff',
    location: 'Berlin, Germany',
    summary: [
      'Northgate Freight Systems runs the booking and tracking platform for a network of regional carriers. As a staff engineer you will set the technical direction for the services behind it.',
      'About half your time goes to design reviews, mentoring and cross-team work, and the rest to hands-on code on the hardest problems.',
    ],
    requirements: [
      {
        id: 'be-st-r1',
        kind: 'required',
        skill: 'Go',
        text: 'Deep experience building production services in Go (golang) over many years.',
      },
      {
        id: 'be-st-r2',
        kind: 'required',
        skill: 'Distributed systems',
        text: 'You have designed distributed systems, including event-driven designs built on Kafka, and know how they fail.',
      },
      {
        id: 'be-st-r3',
        kind: 'required',
        skill: 'System design',
        text: 'You lead system design across several teams and write the architecture documents others build from.',
      },
      {
        id: 'be-st-r4',
        kind: 'required',
        skill: 'Microservices',
        text: 'Experience splitting a monolith into microservices and living with the result.',
      },
      {
        id: 'be-st-r5',
        kind: 'required',
        skill: 'Kubernetes',
        text: 'Hands-on experience running production services on Kubernetes.',
      },
      {
        id: 'be-st-r6',
        kind: 'required',
        skill: 'Observability',
        text: 'You build observability into services: metrics, tracing and alerts that people can act on.',
      },
      {
        id: 'be-st-r7',
        kind: 'required',
        skill: 'Mentoring',
        text: 'You mentor senior engineers and raise the technical bar across the organisation.',
      },
      {
        id: 'be-st-r8',
        kind: 'nice_to_have',
        skill: 'Cloud (AWS)',
        text: 'Experience designing systems on AWS.',
      },
      {
        id: 'be-st-r9',
        kind: 'nice_to_have',
        skill: 'Hiring',
        text: 'You have taken part in hiring and interviewing engineers.',
      },
    ],
  },
  {
    id: 'job-fullstack-mid',
    title: 'Full-Stack Engineer',
    company: 'Marlow and Finch Health',
    level: 'Mid',
    location: 'Dublin, Ireland (hybrid)',
    summary: [
      'Marlow and Finch Health makes scheduling software for small physiotherapy clinics. You will build features end to end, from the screen a receptionist sees to the table behind it.',
      'The team is six people. You will talk to clinic staff directly and see your changes used within days.',
    ],
    requirements: [
      {
        id: 'fs-mid-r1',
        kind: 'required',
        skill: 'TypeScript',
        text: 'Three or more years of TypeScript across both a front-end and a back-end codebase.',
      },
      {
        id: 'fs-mid-r2',
        kind: 'required',
        skill: 'React',
        text: 'You build user interfaces with React, including forms and data fetching.',
      },
      {
        id: 'fs-mid-r3',
        kind: 'required',
        skill: 'Node.js',
        text: 'You build and maintain APIs with Node.js.',
      },
      {
        id: 'fs-mid-r4',
        kind: 'required',
        skill: 'SQL',
        text: 'Comfortable writing SQL for application features and reports.',
      },
      {
        id: 'fs-mid-r5',
        kind: 'required',
        skill: 'REST APIs',
        text: 'You design REST APIs and keep them consistent as the product grows.',
      },
      {
        id: 'fs-mid-r6',
        kind: 'required',
        skill: 'Testing',
        text: 'You test your own work with automated unit and end-to-end tests.',
      },
      {
        id: 'fs-mid-r7',
        kind: 'nice_to_have',
        skill: 'Docker',
        text: 'Experience developing and deploying with Docker.',
      },
      {
        id: 'fs-mid-r8',
        kind: 'nice_to_have',
        skill: 'Accessibility',
        text: 'Interest in accessible interface design, since many of our users rely on keyboards.',
      },
    ],
  },
  {
    id: 'job-fullstack-senior',
    title: 'Senior Full-Stack Engineer',
    company: 'Tidewater Learning',
    level: 'Senior',
    location: 'Remote (Americas)',
    summary: [
      'Tidewater Learning builds the platform that language schools use to run lessons and homework online. You will lead the design of new product areas and carry them through to launch.',
      'You will work across the whole stack and help the team decide what to build next.',
    ],
    requirements: [
      {
        id: 'fs-sr-r1',
        kind: 'required',
        skill: 'TypeScript',
        text: 'Five or more years of TypeScript, with strict types across the front end and the back end.',
      },
      {
        id: 'fs-sr-r2',
        kind: 'required',
        skill: 'React',
        text: 'Deep React experience, including performance tuning of large applications.',
      },
      {
        id: 'fs-sr-r3',
        kind: 'required',
        skill: 'Node.js',
        text: 'You have run Node.js services in production and know how to keep them healthy.',
      },
      {
        id: 'fs-sr-r4',
        kind: 'required',
        skill: 'PostgreSQL',
        text: 'Strong PostgreSQL skills, including migrations and query tuning.',
      },
      {
        id: 'fs-sr-r5',
        kind: 'required',
        skill: 'System design',
        text: 'You can take a vague product idea and turn it into a system design the team agrees on.',
      },
      {
        id: 'fs-sr-r6',
        kind: 'required',
        skill: 'Cloud (AWS)',
        text: 'Experience deploying and operating applications on AWS.',
      },
      {
        id: 'fs-sr-r7',
        kind: 'nice_to_have',
        skill: 'GraphQL',
        text: 'Experience building or consuming GraphQL APIs.',
      },
      {
        id: 'fs-sr-r8',
        kind: 'nice_to_have',
        skill: 'Mentoring',
        text: 'You enjoy mentoring mid-level engineers.',
      },
      {
        id: 'fs-sr-r9',
        kind: 'nice_to_have',
        skill: 'CI/CD',
        text: 'Experience improving continuous integration and delivery pipelines.',
      },
    ],
  },
  {
    id: 'job-data-engineer-mid',
    title: 'Data Engineer',
    company: 'Quillfeather Analytics',
    level: 'Mid',
    location: 'Amsterdam, Netherlands',
    summary: [
      'Quillfeather Analytics helps retailers understand their stock and sales. You will build and maintain the pipelines that bring store data into one trustworthy warehouse.',
      'You will work with analysts and data scientists who depend on your tables being right and on time.',
    ],
    requirements: [
      {
        id: 'de-mid-r1',
        kind: 'required',
        skill: 'Python',
        text: 'Three or more years writing production Python for data processing.',
      },
      {
        id: 'de-mid-r2',
        kind: 'required',
        skill: 'SQL',
        text: 'Advanced SQL: window functions, joins on large tables and query tuning.',
      },
      {
        id: 'de-mid-r3',
        kind: 'required',
        skill: 'Data pipelines',
        text: 'You build and schedule data pipelines with a tool such as Airflow or dbt.',
      },
      {
        id: 'de-mid-r4',
        kind: 'required',
        skill: 'Data modelling',
        text: 'Experience with data modelling for a warehouse, including slowly changing dimensions.',
      },
      {
        id: 'de-mid-r5',
        kind: 'required',
        skill: 'Spark',
        text: 'Hands-on experience processing large datasets with Spark.',
      },
      {
        id: 'de-mid-r6',
        kind: 'required',
        skill: 'Cloud (AWS)',
        text: 'Experience running data workloads on AWS.',
      },
      {
        id: 'de-mid-r7',
        kind: 'nice_to_have',
        skill: 'Testing',
        text: 'You write tests for your pipelines and data quality checks.',
      },
      {
        id: 'de-mid-r8',
        kind: 'nice_to_have',
        skill: 'Data visualisation',
        text: 'Experience building simple dashboards in a tool such as Tableau.',
      },
    ],
  },
  {
    id: 'job-data-scientist-senior',
    title: 'Senior Data Scientist',
    company: 'Ostrander Mutual',
    level: 'Senior',
    location: 'Remote (Europe)',
    summary: [
      'Ostrander Mutual insures small farms and rural businesses. You will build the models that price risk and the experiments that tell us whether a change really helped customers.',
      'You will partner with underwriters and product managers, and explain your results to people who do not read code.',
    ],
    requirements: [
      {
        id: 'ds-sr-r1',
        kind: 'required',
        skill: 'Python',
        text: 'Five or more years of Python for data analysis and modelling.',
      },
      {
        id: 'ds-sr-r2',
        kind: 'required',
        skill: 'Machine learning',
        text: 'You have taken machine learning models from idea to production and measured their results.',
      },
      {
        id: 'ds-sr-r3',
        kind: 'required',
        skill: 'Statistics',
        text: 'A strong grounding in statistics, including regression and the limits of what a sample can show.',
      },
      {
        id: 'ds-sr-r4',
        kind: 'required',
        skill: 'SQL',
        text: 'Fluent SQL for exploring data and building training sets.',
      },
      {
        id: 'ds-sr-r5',
        kind: 'required',
        skill: 'Experimentation',
        text: 'You design and analyse A/B tests and other experiments.',
      },
      {
        id: 'ds-sr-r6',
        kind: 'required',
        skill: 'Data visualisation',
        text: 'You turn results into clear data visualisation for non-technical readers.',
      },
      {
        id: 'ds-sr-r7',
        kind: 'nice_to_have',
        skill: 'Stakeholder communication',
        text: 'Experience presenting findings to senior stakeholders.',
      },
      {
        id: 'ds-sr-r8',
        kind: 'nice_to_have',
        skill: 'Mentoring',
        text: 'You have mentored junior analysts or scientists.',
      },
    ],
  },
  {
    id: 'job-engineering-manager',
    title: 'Engineering Manager',
    company: 'Halcyon Transit',
    level: 'Manager',
    location: 'London, UK (hybrid)',
    summary: [
      'Halcyon Transit builds the journey-planning apps that regional bus and tram operators put their name on. You will lead a team of seven engineers across web, mobile and services.',
      'You will grow the people on your team, keep delivery steady, and be the link between engineering and the operators we serve.',
    ],
    requirements: [
      {
        id: 'em-r1',
        kind: 'required',
        skill: 'People management',
        text: 'Two or more years of people management, including one-to-ones, performance reviews and difficult conversations.',
      },
      {
        id: 'em-r2',
        kind: 'required',
        skill: 'Hiring',
        text: 'You have run hiring for engineers, from writing the role to making the offer.',
      },
      {
        id: 'em-r3',
        kind: 'required',
        skill: 'Project delivery',
        text: 'A record of project delivery: you plan a roadmap, hit milestones and say so early when you will not.',
      },
      {
        id: 'em-r4',
        kind: 'required',
        skill: 'Stakeholder communication',
        text: 'You keep stakeholders informed and say no clearly when you need to.',
      },
      {
        id: 'em-r5',
        kind: 'required',
        skill: 'Agile',
        text: 'Practical experience running Agile teams, with sprints and retrospectives that lead to change.',
      },
      {
        id: 'em-r6',
        kind: 'required',
        skill: 'Mentoring',
        text: 'You mentor engineers and help them grow into the next level.',
      },
      {
        id: 'em-r7',
        kind: 'nice_to_have',
        skill: 'System design',
        text: 'Enough technical depth to take part in system design reviews.',
      },
      {
        id: 'em-r8',
        kind: 'nice_to_have',
        skill: 'CI/CD',
        text: 'Experience improving how a team releases software through continuous delivery.',
      },
    ],
  },
]
