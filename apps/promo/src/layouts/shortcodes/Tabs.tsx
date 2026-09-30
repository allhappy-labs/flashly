import { markdownify } from "@/lib/utils/textConverter";
import React, { useCallback, useEffect, useId, useState } from "react";

const getTabMarkup = (content: string) => ({
  __html: markdownify(content, true),
});

const Tabs = ({ children }: { children: React.ReactElement<{ value?: string }> }) => {
  const [active, setActive] = useState<number>(0);
  const [defaultFocus, setDefaultFocus] = useState<boolean>(false);
  const tabIdPrefix = useId();

  useEffect(() => {
    if (defaultFocus) {
      document.getElementById(`${tabIdPrefix}-tab-${active}`)?.focus();
    } else {
      setDefaultFocus(true);
    }
  }, [active, defaultFocus, tabIdPrefix]);

  const tabMarkup = typeof children.props.value === "string" ? children.props.value : "";
  const tabLinks = Array.from(
    tabMarkup.matchAll(
      /<div\s+data-name="([^"]+)"[^>]*>((?:.|\n)*?)<\/div>/g,
    ),
    (match: RegExpMatchArray) => ({ name: match[1], children: match[0] }),
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLLIElement>) => {
    const index = Number(event.currentTarget.dataset.index);
    if (event.key === "Enter" || event.key === " ") {
      setActive(index);
    } else if (event.key === "ArrowRight") {
      setActive((active + 1) % tabLinks.length);
    } else if (event.key === "ArrowLeft") {
      setActive((active - 1 + tabLinks.length) % tabLinks.length);
    }
  }, [active, tabLinks.length]);

  const handleTabClick = useCallback((event: React.MouseEvent<HTMLLIElement>) => {
    setActive(Number(event.currentTarget.dataset.index));
  }, []);

  return (
    <div className="tab">
      <ul className="tab-nav">
        {tabLinks.map(
          (item: { name: string; children: string }, index: number) => (
            <li
              key={item.name}
              id={`${tabIdPrefix}-tab-${index}`}
              data-index={index}
              className={`tab-nav-item ${index === active && "active"}`}
              role="tab"
              tabIndex={index === active ? 0 : -1}
              onKeyDown={handleKeyDown}
              onClick={handleTabClick}
            >
              {item.name}
            </li>
          ),
        )}
      </ul>
      {tabLinks.map((item: { name: string; children: string }, index: number) => (
        <div
          className={active === index ? "tab-content block px-5" : "hidden"}
          key={item.name}
          dangerouslySetInnerHTML={getTabMarkup(item.children)}
        />
      ))}
    </div>
  );
};

export default Tabs;
