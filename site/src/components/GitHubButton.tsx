import { GITHUB_URL } from '../data/site';

const GitHubMark = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5Z" />
  </svg>
);

type Props = { variant?: 'primary' | 'secondary'; label?: string };

export default function GitHubButton({ variant = 'secondary', label = 'GitHub' }: Props) {
  return (
    <a
      className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
      href={GITHUB_URL}
      target="_blank"
      rel="noopener"
    >
      <GitHubMark />
      {label}
    </a>
  );
}
