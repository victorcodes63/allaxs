interface JsonLdProps {
  /** A JSON-LD object (or array of objects) that will be serialized into the script tag. */
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  /**
   * Optional stable id used to deduplicate the script tag when multiple JSON-LD
   * blocks live on the same page. React keys this off automatically when
   * rendering inside a list, but having an explicit id makes debugging easier.
   */
  id?: string;
}

/**
 * Render a `<script type="application/ld+json">` tag with serialized structured
 * data. Keep payloads serializable (no functions, no circular refs).
 */
export function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      id={id}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
