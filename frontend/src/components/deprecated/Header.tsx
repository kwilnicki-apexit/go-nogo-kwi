interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  return (
    <header style={{
      backgroundColor: 'var(--orlen-red)',
      padding: '1.5rem 2rem',
      color: 'var(--white)',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    }}>
      <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>
        {title}
      </h1>
    </header>
  );
};