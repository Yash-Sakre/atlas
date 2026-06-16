import React, { useEffect, useState } from 'react';

export interface AvatarProps {
  src: string;
  alt?: string;
  size?: number;
}

/**
 * Round user avatar. Default-exported arrow-function component.
 */
const Avatar = ({ src, alt = 'avatar', size = 40 }: AvatarProps) => {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ borderRadius: '50%' }}
    />
  );
};

export default Avatar;

/**
 * useInfiniteScroll — a custom hook colocated in a component file on purpose,
 * to prove detection is path-independent.
 *
 * Calls `onLoadMore` when the sentinel nears the viewport.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  hasMore: boolean,
): (node: HTMLElement | null) => void {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoadMore();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, hasMore, onLoadMore]);

  return setNode;
}
