/** @jsxImportSource hono/jsx */
export const Stickers = ({ data }) => {
  return (
    <html>
      <body
        style={{
          margin: "0",
          padding: "0",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          {data.map((item) => (
            <img
              style={{
                width: "100%",
                height: "auto",
              }}
              src={`data:image/svg+xml;base64, ${item.file}`}
            />
          ))}
        </div>
      </body>
    </html>
  );
};
