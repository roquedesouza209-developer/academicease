import "./globals.css";

export const metadata = {
  title: "AcademicEase",
  description:
    "AcademicEase is an academic results management system for marks entry, automatic calculations, analysis, and report generation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
