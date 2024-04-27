export function formatDate(date: Date, withoutTime = false) {
  date.setHours(date.getHours() + 3);
  // Format the day and month
  const dayMonthOptions = {
    day: "2-digit",
    month: "long",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", dayMonthOptions);
  const dayMonth = dayMonthFormatter.format(date).replace(" ", "_");

  if (withoutTime) {
    // Return only day and month if withoutTime is true
    return dayMonth;
  } else {
    // Format the time
    const timeOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const timeFormatter = new Intl.DateTimeFormat("ru-RU", timeOptions);
    const time = timeFormatter.format(date).replace(":", ":"); // This replace is redundant and can be removed

    // Combine both parts
    return `${dayMonth}_${time}`;
  }
}
