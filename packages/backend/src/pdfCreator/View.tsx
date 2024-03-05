import { productCards } from "../../db/schema";

export const ViewTest = ({
  data,
  supplyId,
}: {
  data: (typeof productCards.$inferSelect)[];
  supplyId: string;
}) => {
  return (
    <html>
      <body
        style={{
          display: "flex",
          justifyContent: "center",
          fontFamily: "Arial",
        }}
      >
        <div>
          <p>
            Лист подбора <strong>{supplyId}</strong>
          </p>
          <p>
            Количество товаров: <strong>{data.length}</strong>.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <table
              style={{ borderCollapse: "separate", borderSpacing: "0 1em" }}
            >
              <tr style={{ paddingBottom: "10px", textAlign: "left" }}>
                <th>Фото</th>
                <th>Бренд</th>
                <th>Наименование</th>
                <th>Артикул продавца</th>
              </tr>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <img style={{ width: "100px" }} src={item.img} />
                  </td>
                  <td style={{ padding: "0 10px 0 10px" }}>{item.brand}</td>
                  <td style={{ padding: "0 10px 0 10px" }}>{item.title}</td>
                  <td style={{ padding: "0 10px 0 10px" }}>{item.id}</td>
                </tr>
              ))}
            </table>
          </div>
        </div>
      </body>
    </html>
  );
};
