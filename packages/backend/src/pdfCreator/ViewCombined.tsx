/** @jsxImportSource hono/jsx */
import { productCards } from "../../db/schema";

export const ViewCombined = ({
  data,
  supplyIds,
  headerTitle = "Листы подбора:",
  isWaitingOrdersOnly = false,
}: {
  data: (typeof productCards.$inferSelect & {
    createdAt?: string;
    orderId?: number;
    stickers?: any;
  })[];
  supplyIds: string[];
  headerTitle?: string;
  isWaitingOrdersOnly?: boolean;
}) => {
  const css = `

  html, body {
    print-color-adjust: exact;
  }
  table {
    font-family: arial, sans-serif;
    border-collapse: separate;
    width: 100%;
  }

  .tdAndTh {
    border: 2px solid black;
    text-align: left;
    padding: 4px;
  }

  .stickers {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  

  tr:nth-child(even) {
    background-color: #e1e1e1;
  }

  @media print {
    tr:nth-child(even) {
      background-color: #e1e1e1; /* Ensure background color is applied in print */
    }
  }
  `;
  return (
    <html>
      <style>{css}</style>
      <body
        style={{
          fontFamily: "Arial",
        }}
      >
        <div>
          <p>{headerTitle}</p>
          <ul>
            {supplyIds.map((supplyId) => (
              <li>
                {" "}
                Лист подбора <strong>{supplyId}</strong>
              </li>
            ))}
          </ul>
          <p>
            Количество товаров: <strong>{data.length}</strong>.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <table
              style={{
                borderCollapse: "collapse",
                borderSpacing: "0 5px",
                fontSize: "12px",
                width: "100%",
              }}
            >
              <tr style={{ paddingBottom: "10px", textAlign: "left" }}>
                <th class="tdAndTh">N задания</th>
                <th class="tdAndTh">Фото</th>
                <th class="tdAndTh">Бренд</th>
                <th class="tdAndTh">Наименование</th>
                <th class="tdAndTh">{isWaitingOrdersOnly ? "Создан" : "ВГ"}</th>
                <th class="tdAndTh" style={{ padding: "8px" }}>
                  Арт.WB
                </th>
                <th class="tdAndTh">Cтикеры</th>
              </tr>
              {data.map((item) => (
                <tr key={item.id}>
                  <td class="tdAndTh">{item.orderId}</td>
                  <td class="tdAndTh" style={{ textAlign: "center" }}>
                    <img style={{ width: "90px" }} src={item.img || ""} />
                  </td>
                  <td class="tdAndTh">{item.brand}</td>
                  <td class="tdAndTh">{item.title}</td>
                  <td class="tdAndTh">
                    {isWaitingOrdersOnly && item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : item.ageGroup}
                  </td>
                  <td class="tdAndTh" style={{ padding: "8px" }}>
                    {item.id}
                  </td>
                  <td class="tdAndTh">
                    <p class="stickers">
                      <span style={{ fontSize: "10px" }}>
                        {item.stickers.partA}{" "}
                      </span>
                      <strong>{item.stickers.partB}</strong>
                    </p>
                  </td>
                </tr>
              ))}
            </table>
          </div>
        </div>
      </body>
    </html>
  );
};
