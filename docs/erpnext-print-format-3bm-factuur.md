# ERPNext Print Format Backup — 3BM Factuur+Smart Urenstaat

> Saved 2026-05-18 after letterhead/footer flush-corners work.
> Live on https://3bm.prilk.cloud — this is a snapshot for reference + recreation.

## Doctype settings

| Field | Value |
|---|---|
| name | 3BM Factuur+Smart Urenstaat |
| doc_type | Sales Invoice |
| custom_format | 1 |
| pdf_generator | wkhtmltopdf |
| margin_top | 0.0 |
| margin_bottom | 55.0 |
| margin_left | 0.0 |
| margin_right | 0.0 |
| font_size | 14 |

## The breakthrough — flush corners via Frappe's native --footer-html

Frappe's `prepare_header_footer()` in `frappe/utils/pdf.py` extracts a `<div id="footer-html">` element from the body HTML and passes it as `--footer-html` flag to wkhtmltopdf. Works with `custom_format=1` (custom Jinja body kept).

**Crucial CSS** — must be at top of `css` field with EXPLICIT margin properties (cssutils does NOT expand `margin: 0` shorthand into `margin-left/right/top/bottom`):

```css
.print-format { margin-top: 0; margin-bottom: 55mm; margin-left: 0; margin-right: 0; }
```

`read_options_from_html()` reads these and passes to wkhtmltopdf as `--margin-*` flags, defeating Frappe's `or "15mm"` default fallback that the doctype `margin_left/right` fields cannot defeat (0 is Python-falsy).

## Footer HTML structure

The footer-html div uses absolute positioning within a 55mm-tall viewport (matches margin-bottom). All 3 columns top-anchored with `top: 31mm` for perfect vertical alignment.

## CSS

```css
.print-format { margin-top: 0; margin-bottom: 55mm; margin-left: 0; margin-right: 0; }
@page { size: A4; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; font-family: Arial, sans-serif; font-size: 12px; }
.print-format, .print-format-container, .print-format-gutter, .printview, #body, #page-print-format, .layout-main-section, .layout-main { margin: 0 !important; padding: 0 !important; max-width: none !important; width: 100% !important; box-shadow: none !important; }
.main-content { width: 100%; margin: 0; padding: 0 15mm; box-sizing: border-box; }
.main-content + .main-content { page-break-before: always; }
.letter-head { margin: 0 0 10px 0; padding: 16mm 0 0 10.3mm; }
.content { box-sizing: border-box; }
.header { display: flex; justify-content: flex-end; align-items: flex-start; margin-bottom: 20px; }
.title { text-align: right; }
.title h1 { margin: 0; }
.info-details { display: table; width: 100%; margin-bottom: 25px; table-layout: fixed; }
.info-details > div { display: table-cell; vertical-align: top; width: 50%; }
.details-table, .activities-table, .totals { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
.totals td { border: 1px solid #ccc; padding: 10px; font-size: 0.9em; }
.activities-table td { border: 1px solid #ccc; padding: 8px; font-size: 0.75em; }
.activities-table th { background: #D3D3D3; font-size: 0.75em; }
.details-table th, .details-table td { padding: 8px; font-size: 0.9em; }
.details-table th { background: #D3D3D3; font-size: 0.9em; }
.details-table th, .activities-table th { font-weight: 600; color: black; }
.notes { font-size: 0.9em; margin-bottom: 25px; width: 100%; }
.totals { margin-top: 10px; float: right; }
.totals th { background: #D3D3D3; font-weight: 600; color: black; }
th, td { border-style: hidden; }
.totals::after, .info-details::after { content: ""; display: block; clear: both; }
.letter-head img { width: 58mm !important; height: auto !important; }
```

## HTML

```html
<div class="main-content">
    {% if letter_head %}<div class="letter-head">{{ letter_head }}</div>{% endif %}
    <div class="header">
        <div class="title">
            <h1><strong>FACTUUR</strong></h1>
            <p>{{ doc.name }}</p>
        </div>
    </div>
    <hr>
    <div class="content">
        <div class="info-details">
            <div>
                {% set customer = frappe.get_doc('Customer', doc.customer) %}
                {% set address = frappe.db.get_value('Address', doc.customer_address, ['address_line1', 'address_line2', 'city', 'pincode', 'country'], as_dict=True) %}
                <p><strong>{{ customer.customer_name }}</strong></p>
                {% if address %}
                    <p>{{ address.address_line1 }}</p>
                    {% if address.address_line2 %}<p>{{ address.address_line2 }}</p>{% endif %}
                    <p>{{ address.pincode }} {{ address.city }}</p>
                {% endif %}
            </div>
            <div>
                <p><strong>Projectnummer:</strong> {{ doc.project }}</p>
                {% set project_name = frappe.db.get_value('Project', doc.project, 'project_name') %}
                <p><strong>Project:</strong> {{ project_name }}</p>
                <p><strong>Kenmerk Opdrachtgever:</strong> {{ doc.custom_customer_reference }}</p>
                <p><strong>Factuurnummer:</strong> {{ doc.name }}</p>
                <p><strong>Datum:</strong> {{ frappe.utils.formatdate(doc.posting_date, "dd-mm-yyyy") }}</p>
            </div>
        </div>
        <p>Hierbij brengen wij de kosten in rekening voor de werkzaamheden ten behoeve van project {{ doc.project }} {{ project_name }}.</p>

        <table class="table details-table table-bordered">
            <thead><tr><th>Onderdeel</th><th>Aantal</th><th>Prijs</th><th style="text-align: right">Totaal</th></tr></thead>
            <tbody>
                {% for item in doc.items %}
                <tr>
                    <td>{{ item.item_name or 'N/A' }}</td>
                    <td>{{ item.qty or 0 }} {{ item.uom or 'Stuk' }}</td>
                    <td>€ {{ '%.2f' % item.rate if item.rate is not none else '0.00' }}</td>
                    <td style="text-align: right">€ {{ '%.2f' % item.amount or 0 }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>

        <div class="info-details">
            <div></div>
            <div>
                <table class="table totals table-bordered">
                    <tbody>
                        <tr><td>Subtotaal (Excl. BTW)</td><td style="text-align: right">€ {{ '%.2f' % doc.total }}</td></tr>
                        {% for item in doc.taxes %}
                        <tr><td>BTW {{ '%.2f' % item.rate or 0 }}%</td><td style="text-align: right">€ {{ '%.2f' % item.tax_amount or 0 }}</td></tr>
                        {% endfor %}
                    </tbody>
                    <tr><th><strong>Totaal</strong></th><th style="text-align: right"><strong>€ {{ '%.2f' % doc.grand_total }}</strong></th></tr>
                </table>
            </div>
        </div>
        {% if doc.company == "3BM Bouwtechniek V.O.F." %}{% set iban_text = "NL95RABO0152787410 t.n.v. 3BM Bouwtechniek V.O.F." %}
        {% elif doc.company == "3BM Engineering" %}{% set iban_text = "NL54INGB0006629483 t.n.v. 3BM Engineering" %}
        {% elif doc.company == "3BM Bongers Constructies" %}{% set iban_text = "NL85RABO0161606830 t.n.v. 3BM Bongers Constructies" %}
        {% elif doc.company == "3BM Bouwkunde" %}{% set iban_text = "NL38BUNQ2117196071 t.n.v. 3BM Bouwkunde" %}
        {% else %}{% set iban_text = "NL34ABNA0497468425 t.n.v. 3BM Coöperatie U.A." %}{% endif %}
        <div class='notes'>
            <ul>
                <li><p>Gelieve het bedrag binnen 21 dagen over te maken op rekeningnummer: {{ iban_text }} te Zwijndrecht. Factuurnummer vermelden a.u.b.</p></li>
                <br>
                <li><p>Op al onze werkzaamheden zijn onze algemene voorwaarden en de DNR 2011 van toepassing welke op verzoek kunnen worden toegezonden.</p></li>
            </ul>
        </div>
    </div>
</div>
{% set ns = namespace(rows=[]) %}
{% for ts in doc.timesheets %}
    {% set task_id = frappe.db.get_value("Timesheet Detail", ts.timesheet_detail, "task") %}
    {% if task_id %}
        {% set billing_type = frappe.db.get_value("Task", task_id, "custom_billing_type") %}
        {% if billing_type == "Timesheet based" %}{% set ns.rows = ns.rows + [ts] %}{% endif %}
    {% endif %}
{% endfor %}
{% if ns.rows %}
    {% set project_name = frappe.db.get_value('Project', doc.project, 'project_name') %}
    {% set total_filtered_hours = ns.rows | sum(attribute='billing_hours') %}
    {% set timesheets_chunks = ns.rows | batch(12, fill_with=None) %}
    {% for chunk in timesheets_chunks %}
        <div class="main-content" style="page-break-before: always;">
            {% if letter_head %}<div class="letter-head">{{ letter_head }}</div>{% endif %}
            <div class="header">
                <div class="title"><h1><strong>FACTUUR-URENOVERZICHT</strong></h1><p>{{ doc.name }}</p></div>
            </div>
            <div class="content">
                {% if loop.first %}
                    <strong>Project Nummer :</strong> {{ doc.project }}<br>
                    <strong>Project Naam :</strong> {{ project_name }}<br>
                    <strong>Factuur :</strong> {{ doc.name }}<br>
                    <strong>Klant Naam :</strong> {{ doc.customer_name }}<br>
                    <strong>Totaal Gefactureerde Uren (urenbasis) :</strong> {{ '%.2f' % total_filtered_hours }}<br>
                {% endif %}
                <table class="activities-table table table-bordered">
                    <thead><tr><th>Medewerker</th><th>Taak</th><th>From Time</th><th>To Time</th><th>Uren</th><th>Gefactureerde Uren</th><th>Omschrijving</th></tr></thead>
                    <tbody>
                        {% for item in chunk if item %}
                            {% set employee_name = frappe.db.get_value("Timesheet", item.time_sheet, "employee_name") %}
                            {% set hours, task = frappe.db.get_value("Timesheet Detail", item.timesheet_detail, ["hours","task"]) %}
                            {% set task_subject = frappe.db.get_value("Task", task, "subject") if task else None %}
                            {% set get_datetime = frappe.utils.get_datetime %}
                            <tr>
                                <td>{{ employee_name }}</td>
                                <td>{{ task_subject or task or "N/A" }}</td>
                                <td>{% if item.from_time %}{{ get_datetime(item.from_time).strftime('%Y-%m-%d %H:%M') }}{% else %}N/A{% endif %}</td>
                                <td>{% if item.to_time %}{{ get_datetime(item.to_time).strftime('%Y-%m-%d %H:%M') }}{% else %}N/A{% endif %}</td>
                                <td>{{ '%.2f' % hours if hours is not none else 0.00 }}</td>
                                <td>{{ '%.2f' % item.billing_hours if item.billing_hours is not none else 0.00 }}</td>
                                <td>{{ item.description or 'N/A' }}</td>
                            </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>
    {% endfor %}
{% endif %}

{% if doc.company == "3BM Engineering" %}
  {% set f_bedrijf = "3BM Engineering" %}{% set f_kvk = "20155514" %}{% set f_btw = "NL002192036B94" %}{% set f_iban = "NL54INGB0006629483" %}{% set f_bic = "INGBNL2A" %}{% set f_email = "administratie@3bm.co.nl" %}{% set f_tel = "078-7400 253" %}
{% elif doc.company == "3BM Bouwkunde" %}
  {% set f_bedrijf = "3BM Bouwkunde" %}{% set f_kvk = "93718810" %}{% set f_btw = "NL005038310B67" %}{% set f_iban = "NL38BUNQ2117196071" %}{% set f_bic = "BUNQNL2A" %}{% set f_email = "jochem@3bm.co.nl" %}{% set f_tel = "06 433 61 450" %}
{% elif doc.company == "3BM Bongers Constructies" %}
  {% set f_bedrijf = "3BM Bongers Constructies" %}{% set f_kvk = "98099299" %}{% set f_btw = "NL003453873B30" %}{% set f_iban = "NL85RABO0161606830" %}{% set f_bic = "RABONL2U" %}{% set f_email = "bongers@3bm.co.nl" %}{% set f_tel = "078-7400 254" %}
{% elif doc.company == "3BM Bouwtechniek V.O.F." %}
  {% set f_bedrijf = "3BM Bouwtechniek V.O.F." %}{% set f_kvk = "85083054" %}{% set f_btw = "NL863502052B01" %}{% set f_iban = "NL95RABO0152787410" %}{% set f_bic = "RABONL2U" %}{% set f_email = "elize@3bm.co.nl" %}{% set f_tel = "078-7400 252" %}
{% else %}
  {% set f_bedrijf = "3BM Coöperatie U.A." %}{% set f_kvk = "57498407" %}{% set f_btw = "NL852607763-B01" %}{% set f_iban = "NL34ABNA0497468425" %}{% set f_bic = "ABNANL2A" %}{% set f_email = "info@3bm.co.nl" %}{% set f_tel = "078-7400 250" %}
{% endif %}
<div id="footer-html">
  <div style="position:relative;width:100%;height:55mm;margin:0;padding:0;font-family:Arial,sans-serif;font-size:7pt;line-height:1.32;">
    <img src="https://3bm.prilk.cloud/files/letterhead-corner-bl.svg" style="position:absolute;left:0;bottom:0;width:10mm;height:27mm;">
    <img src="https://3bm.prilk.cloud/files/letterhead-corner-br.svg" style="position:absolute;right:0;bottom:0;width:42mm;height:48mm;">
    <div style="position:absolute;left:25.3mm;top:31mm;line-height:1.32;"><span style="font-size:8pt;"><strong>{{ f_bedrijf }}</strong></span><br>Wattstraat 17<br>3335 LV Zwijndrecht</div>
    <div style="position:absolute;left:67.28mm;top:31mm;line-height:1.32;"><strong>T</strong>&nbsp;{{ f_tel }}<br><strong>E</strong>&nbsp;{{ f_email }}<br><strong>W</strong>&nbsp;www.3bm.co.nl</div>
    <div style="position:absolute;left:114.14mm;top:31mm;line-height:1.32;">
      <span style="display:inline-block;width:13mm;"><strong>KvK</strong></span>{{ f_kvk }}<br>
      <span style="display:inline-block;width:13mm;"><strong>BTW</strong></span>{{ f_btw }}<br>
      <span style="display:inline-block;width:13mm;"><strong>IBAN</strong></span>{{ f_iban }}<br>
      <span style="display:inline-block;width:13mm;"><strong>BIC</strong></span>{{ f_bic }}
    </div>
  </div>
</div>
```
