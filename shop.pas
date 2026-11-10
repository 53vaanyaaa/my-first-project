program Magazin;
var
  nazv: string;
  cena, summa, skidka, itog: real;
  kol: integer;

procedure Stoimost;
begin
  summa := cena * kol;
end;

procedure Skidka_;
begin
  if summa > 1000 then skidka := summa * 0.1
  else if summa >= 500 then skidka := summa * 0.05
  else skidka := 0;
end;

begin
  write('Nazvanie tovara: ');
  readln(nazv);
  write('Cena: ');
  readln(cena);
  write('Kolichestvo: ');
  readln(kol);
  Stoimost;
  Skidka_;
  itog := summa - skidka;
  writeln('Tovar: ', nazv);
  writeln('Stoimost: ', summa:0:2);
  writeln('Skidka: ', skidka:0:2);
  writeln('K oplate: ', itog:0:2);
  readln;
end.
