export function formatDate(date: Date) {
  date.setHours(date.getHours() + 3);
  // Format the day and month
  const dayMonthOptions = {
    day: "2-digit",
    month: "long",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", dayMonthOptions);
  const dayMonth = dayMonthFormatter.format(date).replace(" ", "_");

  // Format the time
  const timeOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const timeFormatter = new Intl.DateTimeFormat("ru-RU", timeOptions);
  const time = timeFormatter.format(date).replace(":", ":");

  // Combine both parts
  return `${dayMonth}_${time}`;
}
