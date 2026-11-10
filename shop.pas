program ShopCalc;
{ Расчет стоимости покупки в магазине (Turbo Pascal 7) }
uses Crt;

var
  Name: string;           { название товара }
  Price: real;            { цена одной единицы, леев }
  Qty: integer;           { количество единиц }
  Total: real;            { первоначальная стоимость }
  Discount: real;         { размер скидки, леев }
  Percent: real;          { процент скидки }
  ToPay: real;            { итог к оплате }

{ Процедура 1: вычисляет общую стоимость }
procedure CalcTotal(Price: real; Qty: integer; var Total: real);
begin
  Total := Price * Qty;
end;

{ Процедура 2: определяет скидку }
procedure CalcDiscount(Total: real; var Percent, Discount: real);
begin
  if Total > 1000 then
    Percent := 10
  else if Total >= 500 then
    Percent := 5          { 500..1000 лей - по условию % не задан, взято 5 }
  else
    Percent := 0;
  Discount := Total * Percent / 100;
end;

begin
  ClrScr;
  Write('Nazvanie tovara: ');
  ReadLn(Name);
  Write('Cena odnogo tovara (lei): ');
  ReadLn(Price);
  Write('Kolichestvo edinic: ');
  ReadLn(Qty);

  CalcTotal(Price, Qty, Total);
  CalcDiscount(Total, Percent, Discount);
  ToPay := Total - Discount;

  WriteLn;
  WriteLn('Tovar               : ', Name);
  WriteLn('Pervonachalnaya sum.: ', Total:0:2, ' lei');
  WriteLn('Skidka (', Percent:0:0, '%)       : ', Discount:0:2, ' lei');
  WriteLn('Itogo k oplate      : ', ToPay:0:2, ' lei');
  ReadLn;
end.
