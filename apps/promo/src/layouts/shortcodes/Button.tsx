import React from "react";

const Button = ({
  label,
  link,
  style,
  rel,
}: {
  label: string;
  link: string;
  style?: string;
  rel?: string;
}) => {
  const isExternalLink = link.startsWith("http");
  const target = isExternalLink ? "_blank" : "_self";
  const relValue = isExternalLink
    ? `noopener noreferrer ${rel ? (rel === "follow" ? "" : rel) : "nofollow"}`.trim()
    : (rel === "follow" ? undefined : rel);

  return (
    <a
      href={link}
      target={target}
      rel={relValue}
      className={`btn mb-4 me-4 hover:text-white no-underline ${style === "outline" ? "btn-outline-primary" : "btn-primary"
        }`}
    >
      {label}
    </a>
  );
};

export default Button;
