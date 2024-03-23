export function formatDate(date: Date) {
  // Format the day and month
  const dayMonthOptions = { day: "2-digit", month: "long" };
  const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", dayMonthOptions);
  const dayMonth = dayMonthFormatter.format(date).replace(" ", "_");

  // Format the time
  const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  const timeFormatter = new Intl.DateTimeFormat("ru-RU", timeOptions);
  const time = timeFormatter.format(date).replace(":", ":");

  // Combine both parts
  return `${dayMonth}_${time}`;
}
