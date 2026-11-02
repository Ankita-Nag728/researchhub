"""Clearly-labelled demonstration data for local development.

- Projects are fictional: "Sample Institution" and "Sample Supervisor" stand in for real
  universities and people, so nothing here implies a real partnership or endorsement.
- Papers are real, well-known publications. Only metadata and a link to the legitimate
  source are stored. The summaries are written for this demo, NOT copied abstracts.
- Every record has is_sample = true and a visible "[Sample]" marker.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database.session import get_session_factory
from app.models import ResearchPaper, ResearchProject
from app.routers.projects import unique_slug

INSTITUTIONS = ["Sample Institution A (demo)", "Sample Institution B (demo)", "Sample Institution C (demo)"]
SUPERVISOR = "Sample Supervisor (demo)"
NOTE = "This is demonstration data created for local development. It does not describe a real project."

# (title, domain, short, skills, status, deadline in days, positions, institution index)
PROJECTS = [
    ("[Sample] Explainable Models for Small Clinical Datasets", "Artificial Intelligence",
     "Explore how to explain predictions of models trained on very small datasets.",
     ["Python", "Statistics", "scikit-learn"], "open", 45, 2, 0),
    ("[Sample] Language Model Evaluation Without Labels", "Machine Learning",
     "Design and compare ways to evaluate text models when no reference answers exist.",
     ["Python", "PyTorch", "Writing"], "open", 30, 3, 1),
    ("[Sample] Mapping Urban Heat with Open Data", "Data Science",
     "Combine open satellite and weather data to visualise how heat varies across a city.",
     ["Python", "pandas", "Data visualisation"], "open", 60, 2, 2),
    ("[Sample] Phishing Email Detection in Practice", "Cybersecurity",
     "Study why phishing detectors fail on new campaigns and test simple fixes.",
     ["Python", "Networking basics", "Security fundamentals"], "open", 21, 1, 0),
    ("[Sample] River Water Quality Monitoring Pipeline", "Environmental Science",
     "Build a reproducible pipeline that cleans and analyses public river-monitoring readings.",
     ["R or Python", "Statistics", "GIS basics"], "ongoing", 90, 1, 1),
    ("[Sample] Reproducing Published Results in Genomics", "Biotechnology",
     "Attempt to reproduce the headline figures of a published open-data analysis.",
     ["Python", "Biology basics", "Git"], "completed", -10, 0, 2),
    ("[Sample] Teaching Algorithms with Interactive Visualisations", "Computer Science",
     "Prototype and test interactive visualisations that help first-year students learn algorithms.",
     ["JavaScript", "Teaching interest", "UX basics"], "open", 14, 2, 2),
]

# (title, authors, year, category, journal, doi, url, summary)
PAPERS = [
    ("Attention Is All You Need", "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin",
     2017, "Machine Learning", "Advances in Neural Information Processing Systems (NeurIPS)", "10.48550/arXiv.1706.03762",
     "https://arxiv.org/abs/1706.03762", "Introduces the Transformer, a sequence model built on attention instead of recurrence."),
    ("Deep Residual Learning for Image Recognition", "Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun",
     2016, "Artificial Intelligence", "IEEE Conference on Computer Vision and Pattern Recognition (CVPR)", "10.1109/CVPR.2016.90",
     "https://arxiv.org/abs/1512.03385", "Shows that shortcut connections make very deep image networks much easier to train."),
    ("Adam: A Method for Stochastic Optimization", "Diederik P. Kingma, Jimmy Ba",
     2015, "Machine Learning", "International Conference on Learning Representations (ICLR)", "10.48550/arXiv.1412.6980",
     "https://arxiv.org/abs/1412.6980", "Presents Adam, a widely used optimiser that adapts learning rates per parameter."),
    ("Generative Adversarial Nets", "Ian Goodfellow, Jean Pouget-Abadie, Mehdi Mirza, Bing Xu, David Warde-Farley, Sherjil Ozair, Aaron Courville, Yoshua Bengio",
     2014, "Artificial Intelligence", "Advances in Neural Information Processing Systems (NeurIPS)", "10.48550/arXiv.1406.2661",
     "https://arxiv.org/abs/1406.2661", "Proposes training a generator and a discriminator against each other to model data."),
    ("The Limitations of Deep Learning in Adversarial Settings", "Nicolas Papernot, Patrick McDaniel, Somesh Jha, Matt Fredrikson, Z. Berkay Celik, Ananthram Swami",
     2016, "Cybersecurity", "IEEE European Symposium on Security and Privacy (EuroS&P)", "10.1109/EuroSP.2016.36",
     "https://arxiv.org/abs/1511.07528", "Studies how small crafted input changes can make neural networks misclassify."),
    ("Random Forests", "Leo Breiman",
     2001, "Data Science", "Machine Learning, volume 45", "10.1023/A:1010933404324",
     "https://doi.org/10.1023/A:1010933404324", "Describes combining many randomised decision trees into one accurate classifier."),
    ("Tackling Climate Change with Machine Learning", "David Rolnick, Priya L. Donti, Lynn H. Kaack, Kelly Kochanski, Alexandre Lacoste, Kris Sankaran, Andrew Slavin Ross, Nikola Milojevic-Dupont, Natasha Jaques, Anna Waldman-Brown, Alexandra Luccioni, Tegan Maharaj, Evan D. Sherwin, S. Karthik Mukkavilli, Konrad P. Kording, Carla Gomes, Andrew Y. Ng, Demis Hassabis, John C. Platt, Felix Creutzig, Jennifer Chayes, Yoshua Bengio",
     2019, "Environmental Science", "arXiv preprint (later published in ACM Computing Surveys)", "10.48550/arXiv.1906.05433",
     "https://arxiv.org/abs/1906.05433", "Surveys areas where machine learning can help reduce or adapt to climate change."),
    ("Highly accurate protein structure prediction with AlphaFold", "John Jumper, Richard Evans, Alexander Pritzel, and colleagues",
     2021, "Biotechnology", "Nature, volume 596", "10.1038/s41586-021-03819-2",
     "https://doi.org/10.1038/s41586-021-03819-2", "Reports a neural network that predicts protein 3D structure from sequence at high accuracy."),
]


def seed_demo() -> dict:
    added = {"projects": 0, "papers": 0}
    now = datetime.now(timezone.utc)
    with get_session_factory()() as db:
        for title, domain, short, skills, status, days, positions, inst in PROJECTS:
            if db.scalar(select(ResearchProject.id).where(ResearchProject.title == title)):
                continue
            db.add(ResearchProject(
                title=title, slug=unique_slug(db, title), short_description=short,
                full_description=f"{short} {NOTE}", research_objectives=f"Sample objectives. {NOTE}",
                domain=domain, institution=INSTITUTIONS[inst], supervisor=SUPERVISOR,
                required_skills=skills, eligibility="Sample eligibility: open to any enrolled student (demo).",
                duration="3 months (sample)", available_positions=positions,
                application_deadline=now + timedelta(days=days),
                application_instructions="Sample instructions: complete the application form on this page.",
                status=status, is_sample=True,
            ))
            added["projects"] += 1
        for title, authors, year, category, journal, doi, url, summary in PAPERS:
            if db.scalar(select(ResearchPaper.id).where(ResearchPaper.doi == doi)):
                continue
            db.add(ResearchPaper(
                title=title, authors=authors, publication_year=year, category=category, journal=journal, doi=doi,
                external_url=url, is_sample=True,
                abstract=f"[Sample summary written for this demo, not the original abstract] {summary}",
            ))
            added["papers"] += 1
        db.commit()
    return added
